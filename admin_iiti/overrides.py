from typing import Dict, Optional, Tuple
from frappe.model.document import Document
from datetime import date, datetime, timedelta
from erpnext.buying.doctype.supplier_scorecard.supplier_scorecard import daterange
from erpnext.setup.doctype.employee.employee import get_holiday_list_for_employee
from hrms.hr.doctype.leave_ledger_entry.leave_ledger_entry import create_leave_ledger_entry
import frappe
from frappe.utils import nowdate, unique
from frappe.desk.reportview import get_filters_cond, get_match_cond
from frappe import _
from frappe.query_builder.functions import Max, Min, Sum
from frappe.utils import (
    add_days,
    cint,
    cstr,
    date_diff,
    flt,
    formatdate,
    get_fullname,
    get_link_to_form,
    getdate,
    nowdate,
)
from hrms.hr.utils import (
    get_holiday_dates_for_employee,
    get_leave_period,
    set_employee_name,
    share_doc_with_approver,
    validate_active_employee,
)


class NotAnOptionalHoliday(frappe.ValidationError):
    pass

class OverlapError(frappe.ValidationError):
	pass


from hrms.hr.doctype.leave_application.leave_application import LeaveApplication


# from hrms.hr.doctype.leave_application.leave_application import  *


class CustomLeaveApplication(Document):
    def validate(self):
        validate_active_employee(self.employee)
        set_employee_name(self)
        self.validate_dates()
        self.validate_leave_balance_pending()
        self.validate_leave_balance()
        self.validate_leave_overlap()
        self.validate_max_days()
        self.set_half_day_date()
        if frappe.db.get_value("Leave Type", self.leave_type, "is_optional_leave"):
            self.validate_optional_leave()
    def on_update(self):
        #frappe.throw(frappe.as_json(self.status))
        if self.status == "Open" and self.docstatus < 1:
            if self.leave_recommenders:
                for r in self.leave_recommenders:
                    if r.status == 'Open':
                        self.notify_leave(r.recommender)
                        self.share_doc_with_recommender(r.recommender)
            else:
                # notify leave approver about creation
                if frappe.db.get_single_value("HR Settings", "send_leave_notification"):
                    self.notify_leave(self.leave_approver)
                    share_doc_with_approver(self, self.leave_approver)
        if self.status == 'Recommended' and self.docstatus < 1:
            frappe.db.set_value('Leave Application',{'name':self.name},{'status':'Recommended'},update_modified=False)
            self.notify_leave(self.leave_approver)
            share_doc_with_approver(self, self.leave_approver)
                    
    def on_submit(self):
        # frappe.msgprint('custom-submit')
        if self.status == "Open":
            frappe.throw(_("Only Leave Applications with status 'Approved' and 'Rejected' can be submitted"))

        validate_back_dated_application(self)
        update_attendance(self)

        # notify leave applier about approval
        if frappe.db.get_single_value("HR Settings", "send_leave_notification"):
            notify_employee(self)

        self.create_leave_ledger_entry()
        self.reload()
        
    def share_doc_with_recommender(doc, user):
        # if approver does not have permissions, share
        if not frappe.has_permission(doc=doc, ptype="write", user=user):
            frappe.share.add_docshare(doc.doctype, doc.name, user, write=1,flags={"ignore_share_permission": True})
            frappe.msgprint(_("Shared with the user {0} with {1} access").format(user, frappe.bold("write"), alert=True))
            
    def validate_dates(self):
        if frappe.db.get_single_value("HR Settings", "restrict_backdated_leave_application"):
            if self.from_date and getdate(self.from_date) < getdate():
                allowed_role = frappe.db.get_single_value("HR Settings", "role_allowed_to_create_backdated_leave_application")
                user = frappe.get_doc("User", frappe.session.user)
                user_roles = [d.role for d in user.roles]
                if not allowed_role:
                    frappe.throw(
						_("Backdated Leave Application is restricted. Please set the {} in {}").format(
							frappe.bold("Role Allowed to Create Backdated Leave Application"),
							get_link_to_form("HR Settings", "HR Settings"),
						)
					)
                if allowed_role and allowed_role not in user_roles:
                    frappe.throw(_("Only users with the {0} role can create backdated leave applications").format(allowed_role))
                    
    def notify_leave(self,user):
        parent_doc = frappe.get_doc("Leave Application", self.name)
        args = parent_doc.as_dict()
        
        template = 'Leave Approval Notification'
        if not template:
            frappe.msgprint(_("Please set default template for Leave Approval Notification in HR Settings."))
            return
        email_template = frappe.get_doc("Email Template", template)
        message = frappe.render_template(email_template.response_html, args)
        
        notify(self,
               {
                   # for post in messages
                   "message": message,
                   "message_to": user,
                   # for email
                   # "subject": email_template.subject,
                   "subject": email_template.subject + " " + self.employee_name + " from " + self.from_date + " to " + self.to_date,
               }
               )
      
    def create_leave_ledger_entry(self, submit=True):
        if self.status != 'Approved' and submit:
            return
        expiry = frappe.get_all("Leave Ledger Entry",filters={
            'employee': self.employee,
            'leave_type': self.leave_type,
            'is_carry_forward': 1,
            'transaction_type': 'Leave Allocation',
            'to_date': ['between', (self.from_date, self.to_date)]}, fields=['to_date'])
        
        expiry_date = expiry[0]['to_date'] if expiry else None
        
        lwp = frappe.db.get_value("Leave Type", self.leave_type, "is_lwp")

        if expiry_date:
            self.create_ledger_entry_for_intermediate_allocation_expiry(expiry_date, submit, lwp)
        else:
            raise_exception = True
            if frappe.flags.in_patch:
                raise_exception = False

            args = dict(
                leaves=self.total_leave_days * -1,
                from_date=self.from_date,
                to_date=self.to_date,
                is_lwp=lwp,
                holiday_list=get_holiday_list_for_employee(self.employee, raise_exception=raise_exception) or ''
            )
            if self.leave_type_name == 'Commuted Leave' or self.leave_type_name == 'Half Paid Leave' :
                self.HPL_balance_minus()
            else:
                create_leave_ledger_entry(self, args, submit)
                
    def create_ledger_entry_for_intermediate_allocation_expiry(self, expiry_date, submit, lwp):
        """Splits leave application into two ledger entries to consider expiry of allocation"""
        raise_exception = False if frappe.flags.in_patch else True
        
        leaves = get_number_of_leave_days(
            self.employee, self.leave_type, self.from_date, expiry_date, self.half_day, self.half_day_date
        )
        if leaves:
            args = dict(
                from_date=self.from_date,
                to_date=expiry_date,
                leaves=leaves * -1,
                is_lwp=lwp,
                holiday_list=get_holiday_list_for_employee(self.employee, raise_exception=raise_exception)
                or "",
            )
            create_leave_ledger_entry(self, args, submit)
            
        if getdate(expiry_date) != getdate(self.to_date):
            start_date = add_days(expiry_date, 1)
            leaves = get_number_of_leave_days(
                self.employee, self.leave_type, start_date, self.to_date, self.half_day, self.half_day_date
            )
            if leaves:
                args.update(dict(from_date=start_date, to_date=self.to_date, leaves=leaves * -1))
                create_leave_ledger_entry(self, args, submit)
    
    def HPL_balance_minus(self):
        new_to_dateplus = add_days(self.to_date,self.total_leave_days)
        lwp = frappe.db.get_value("Leave Type", 'Half Paid Leave', "is_lwp")
        doc = frappe.new_doc("Leave Ledger Entry")
        doc.employee = self.employee
        doc.employee_name = self.employee_name
        doc.leave_type = 'Half Paid Leave'
        doc.transaction_type = 'Leave Application'
        doc.transaction_name = self.name
        doc.leaves = self.total_leave_days * -2
        doc.company = self.company
        doc.from_date = self.from_date
        doc.to_date =new_to_dateplus
        doc.is_lwp=lwp,
        doc.holiday_list=get_holiday_list_for_employee(self.employee, raise_exception=True) or ''
        doc.flags.ignore_validate = True
        doc.flags.ignore_permissions = 1
        doc.docstatus = 1
        doc.db_insert()
        
    def validate_optional_leave(self):
        leave_period = get_leave_period(self.from_date, self.to_date, self.company)
        if not leave_period:
            frappe.throw(_("Cannot find active Leave Period"))
        optional_holiday_list = frappe.db.get_value(
            "Leave Period", leave_period[0]["name"], "optional_holiday_list"
        )
        if not optional_holiday_list:
            frappe.throw(
                _("Optional Holiday List not set for leave period {0}").format(leave_period[0]["name"])
            )
        day = getdate(self.from_date)
        while day <= getdate(self.to_date):
            if not frappe.db.exists(
                    {"doctype": "Holiday", "parent": optional_holiday_list, "holiday_date": day}
            ):
                frappe.throw(
                    _("{0} is not in Optional Holiday List").format(formatdate(day)), NotAnOptionalHoliday
                )
            day = add_days(day, 1)
            
    def validate_leave_overlap(self):
        if not self.name:
            # hack! if name is null, it could cause problems with !=
            self.name = "New Leave Application"
            
        for d in frappe.db.sql(
            """
            select
                name, leave_type, posting_date, from_date, to_date, total_leave_days, half_day_date
			from `tabLeave Application`
			where employee = %(employee)s and docstatus < 2 and status in ('Open', 'Approved')
			and to_date >= %(from_date)s and from_date <= %(to_date)s
			and name != %(name)s""",
			{
				"employee": self.employee,
				"from_date": self.from_date,
				"to_date": self.to_date,
				"name": self.name,
			},
			as_dict=1,
		):
            if (
                cint(self.half_day) == 1
                and getdate(self.half_day_date) == getdate(d.half_day_date)
                and (
                    flt(self.total_leave_days) == 0.5
                    or getdate(self.from_date) == getdate(d.to_date)
                    or getdate(self.to_date) == getdate(d.from_date)
                )
                ):
                total_leaves_on_half_day = self.get_total_leaves_on_half_day()
                if total_leaves_on_half_day >= 1:
                    self.throw_overlap_error(d)
            else:
                self.throw_overlap_error(d)
                
    def throw_overlap_error(self, d):
        form_link = get_link_to_form("Leave Application", d.name)
        msg = _("Employee {0} has already applied for {1} between {2} and {3} : {4}").format(
            self.employee, d["leave_type"], formatdate(d["from_date"]), formatdate(d["to_date"]), form_link
        )
        frappe.throw(msg, OverlapError)
        
    def validate_max_days(self):
        max_days = frappe.db.get_value("Leave Type", self.leave_type, "max_continuous_days_allowed")
        if max_days and self.total_leave_days > cint(max_days):
            frappe.throw(_("Leave of type {0} cannot be longer than {1}").format(self.leave_type, max_days))
            
    def set_half_day_date(self):
        if self.from_date == self.to_date and self.half_day == 1:
            self.half_day_date = self.from_date
            
        if self.half_day == 0:
            self.half_day_date = None
            
    def validate_leave_balance_pending(self):
        if self.leave_type_name == 'Other Leave':
            return
        
        if not self.leave_balance:
            frappe.throw(_("Leave balance is not set for Leave Type {0} in this allocation.").format(
                frappe.bold(self.leave_type)
            ))
            
        leave_balance = self.leave_balance
        
        # Base SQL query
        sql_query = """
            SELECT SUM(total_leave_days)
            FROM `tabLeave Application`
            WHERE employee = %(employee)s
            AND docstatus < 2
            AND status IN ('Open', 'Recommended')
            AND leave_type = %(leave_type)s
        """
        filters = {
            "employee": self.employee,
            "leave_type": self.leave_type,
        }
        # Add year filter only for RH or CL
        if self.leave_type in ("Casual Leave", "Restricted Holiday Leave"):
            current_year = getdate(nowdate()).year
            sql_query += " AND YEAR(from_date) = %(current_year)s"
            filters["current_year"] = current_year
            
        employee_pending_leave = frappe.db.sql(sql_query, filters)[0][0] or 0
        
        
        # Calculate total (current + pending)
        all_total_pending_leave = employee_pending_leave + self.total_leave_days
        
        # Validation: pending or insufficient balance
        if float(leave_balance) < float(all_total_pending_leave):
            msg = _("Warning: Insufficient leave balance for Leave Type {0}. You have already applied for leave, which is still pending, so you cannot apply for another leave. if you want to apply for kindly cancelled the old pending leave").format(
                frappe.bold(self.leave_type)
            )
            frappe.throw(msg)
    
    def validate_leave_balance(self):
        #int(self.leave_balance)
        if int(self.leave_balance) <= 0 and self.leave_type_name != 'Other Leave':
            msg = _("Warning: Insufficient leave balance for Leave Type {0} in this allocation.").format(
					frappe.bold(self.leave_type)
				)
            frappe.throw(msg)
            
    def validate_leave_approver(self):
        if self.leave_approver == frappe.session.user:
            frappe.throw("Invalid leave approver name selected.")
            
    def get_total_leaves_on_half_day(self):
        leave_count_on_half_day_date = frappe.db.sql(
            """select count(name) from `tabLeave Application`
            where employee = %(employee)s
            and docstatus < 2
            and status in ('Open', 'Approved')
            and half_day = 1
            and half_day_date = %(half_day_date)s
            and name != %(name)s""",
            {"employee": self.employee, "half_day_date": self.half_day_date, "name": self.name},
        )[0][0]
        
        return leave_count_on_half_day_date * 0.5      

@frappe.whitelist()
def get_approvers(doctype, txt, searchfield, start, page_len, filters):
    doctype = "User"
    conditions = []
    fields = get_fields(doctype, ["email", "full_name"])

    return frappe.db.sql(
        """select {fields} from `tabUser`
		where  docstatus < 2
			and ({key} like %(txt)s
				or full_name like %(txt)s)
			{fcond} {mcond}
		order by
			(case when locate(%(_txt)s, name) > 0 then locate(%(_txt)s, name) else 99999 end),
			(case when locate(%(_txt)s, full_name) > 0 then locate(%(_txt)s, full_name) else 99999 end),
			idx desc,
			name, full_name
		limit %(page_len)s offset %(start)s""".format(
            **{
                "fields": ", ".join(fields),
                "key": searchfield,
                "fcond": get_filters_cond(doctype, filters, conditions),
                "mcond": get_match_cond(doctype),
            }
        ),
        {"txt": "%%%s%%" % txt, "_txt": txt.replace("%", ""), "start": start, "page_len": page_len},
    )
    
@frappe.whitelist()
def get_fields(doctype, fields=None):
    if fields is None:
        fields = []
    meta = frappe.get_meta(doctype)
    fields.extend(meta.get_search_fields())

    if meta.title_field and not meta.title_field.strip() in fields:
        fields.insert(1, meta.title_field.strip())

    return unique(fields)

@frappe.whitelist()
def set_leave_status(leave_application_name,doctype, user,action_type, leave_type):
    current_date_time = frappe.utils.now_datetime()
    if action_type == 'Recommended':
        frappe.db.set_value("Leave Recommender",{'parent': leave_application_name,'recommender':user,'parenttype':doctype},{'status': 'Recommended','docstatus':1,'recommend_date_time':current_date_time},update_modified=False)

        status = 'Open'

        recommender_data = frappe.db.count('Leave Recommender',{'parent':leave_application_name,'status':'Recommended','parenttype':doctype})
        total_recommder = frappe.db.count('Leave Recommender',{'parent':leave_application_name})
        
        if recommender_data:
            val = frappe.as_json(recommender_data)
            if val == frappe.as_json(total_recommder):
                #frappe.db.set_value("Leave Application",{'name': leave_application_name},{'status': 'Recommended'},update_modified=False)
                status = 'Recommended'
                return status

    elif action_type == 'Rejected':
        frappe.db.set_value("Leave Recommender",{'parent': leave_application_name,'recommender':user,'parenttype':doctype},{'status': 'Rejected','docstatus':1,'recommend_date_time':current_date_time},update_modified=False)
        
        frappe.db.set_value("Leave Application",{'name': leave_application_name},{'status': 'Rejected','docstatus':1,'doc_approved_date':current_date_time},update_modified=False)
        
        status = 'Rejected'

    return status

@frappe.whitelist()
def doc_status_update(docname,action_type,leave_type):
    if action_type == 'Approved':
        frappe.db.set_value("Leave Application", {"name": docname}, {'status': 'Approved','doc_approved_date':frappe.utils.now_datetime()},update_modified=False)
        
    return action_type


@frappe.whitelist()
def notify(self, args):
    args = frappe._dict(args)
    # args -> message, message_to, subject
    if cint(self.follow_via_email):
        contact = args.message_to
        if not isinstance(contact, list):
            if not args.notify == "employee":
                contact = frappe.get_doc("User", contact).email or contact

        sender = dict()
        sender["email"] = frappe.get_doc("User", frappe.session.user).email
        sender["full_name"] = get_fullname(sender["email"])

        try:
            frappe.sendmail(
                recipients=contact,
                sender=sender["email"],
                subject=args.subject,
                message=args.message,
            )
            frappe.msgprint(_("Email sent to {0}").format(contact))
        except frappe.OutgoingEmailError:
            pass
        
@frappe.whitelist()
def create_or_update_attendance(self, attendance_name, date):
    status = "Half Day" if self.half_day_date and getdate(date) == getdate(self.half_day_date) else "On Leave"

    if attendance_name:
        # update existing attendance, change absent to on leave
        doc = frappe.get_doc('Attendance', attendance_name)
        if doc.status != status:
            doc.db_set({
                'status': status,
                'leave_type': self.leave_type,
                'leave_application': self.name
            })
    else:
        # make new attendance and submit it
        doc = frappe.new_doc("Attendance")
        doc.employee = self.employee
        doc.employee_name = self.employee_name
        doc.attendance_date = date
        doc.company = self.company
        doc.leave_type = self.leave_type
        doc.leave_application = self.name
        doc.status = status
        doc.flags.ignore_validate = True
        doc.insert(ignore_permissions=True)
        doc.submit()
        
@frappe.whitelist()
def validate_back_dated_application(self):
    future_allocation = frappe.db.sql(
        """select name, from_date from `tabLeave Allocation`
			where employee=%s and leave_type=%s and docstatus=1 and from_date > %s
			and carry_forward=1""",
        (self.employee, self.leave_type, self.to_date),
        as_dict=1,
    )

    if future_allocation:
        frappe.throw(
            _(
                "Leave cannot be applied/cancelled before {0}, as leave balance has already been carry-forwarded in the future leave allocation record {1}"
            ).format(formatdate(future_allocation[0].from_date), future_allocation[0].name)
        )

@frappe.whitelist()
def update_attendance(self):
    if self.status != "Approved":
        return

    holiday_dates = []
    if not frappe.db.get_value("Leave Type", self.leave_type, "include_holiday"):
        holiday_dates = get_holiday_dates_for_employee(self.employee, self.from_date, self.to_date)

    for dt in daterange(getdate(self.from_date), getdate(self.to_date)):
        date = dt.strftime("%Y-%m-%d")
        attendance_name = frappe.db.exists(
            "Attendance", dict(employee=self.employee, attendance_date=date, docstatus=("!=", 2))
        )

        # don't mark attendance for holidays
        # if leave type does not include holidays within leaves as leaves
        if date in holiday_dates:
            if attendance_name:
                # cancel and delete existing attendance for holidays
                attendance = frappe.get_doc("Attendance", attendance_name)
                attendance.flags.ignore_permissions = True
                if attendance.docstatus == 1:
                    attendance.cancel()
                frappe.delete_doc("Attendance", attendance_name, force=1)
            continue

        create_or_update_attendance(self, attendance_name, date)
        
@frappe.whitelist()
def notify_employee(self):
    employee = frappe.get_doc("Employee", self.employee)
    if not employee.user_id:
        return

    parent_doc = frappe.get_doc('Leave Application', self.name)
    args = parent_doc.as_dict()

    template = frappe.db.get_single_value('HR Settings', 'leave_status_notification_template')
    if not template:
        frappe.msgprint(_("Please set default template for Leave Status Notification in HR Settings."))
        return
    email_template = frappe.get_doc("Email Template", template)
    message = frappe.render_template(email_template.response_html, args)

    notify(self, {
        # for post in messages
        "message": message,
        "message_to": employee.user_id,
        # for email
        "subject": email_template.subject,
        "notify": "employee"
    })

@frappe.whitelist()
def get_employee_data(user_id):
    data = frappe.db.get_value('Employee', {'user_id':user_id}, ['department', 'designation','employee_id','employee_name','cell_number','salutation'],as_dict =1)
    return data

@frappe.whitelist()
def cancel_leave_application(employee,doctype,docname,docstatus,reason_for_cancel,status):
    if status == 'Cancelled':
        leave_application = frappe.get_value(doctype,{"name": docname},["*"],as_dict = True)
        if docstatus == 'Open':
            cancel_leave_email(docname,leave_application.owner,reason_for_cancel)
        elif docstatus == 'Recommended':
            recommender_data = frappe.db.get_list("Leave Recommender", filters={'parent': docname},fields='*',ignore_permissions = True)
            if recommender_data:
                for re_list in recommender_data:
                    cancel_leave_email(docname,re_list.recommender,reason_for_cancel)
        data = frappe.db.set_value(doctype, {"name": docname}, {'status': status,'docstatus':2},update_modified=False)
    
    return data

@frappe.whitelist()
def get_date_diff(employee,leave_type,from_date,to_date,other_leave_type):
    if leave_type == 'Other Leave' and other_leave_type == 'Headquarter Leave':
        
        number_of_days = date_diff(to_date, from_date) + 1
        
        return number_of_days
    
@frappe.whitelist()
def cancel_leave_email(docname,User,reason):
    if User:
        template = 'Cancel Leave Notification'
        if not template:
            frappe.msgprint(_("Please set default template for Leave Status Notification in HR Settings."))
            
            return
        
        parent_doc = frappe.get_doc('Leave Application',docname)
        args = parent_doc.as_dict()
        args.update({'reason':reason})
        email_template = frappe.get_doc("Email Template", template)
        
        message = frappe.render_template(email_template.response_html, args)
        
        notify(args,{
                "message":message,
                "message_to":User,
                "subject":email_template.subject,
            })
@frappe.whitelist()
def leave_discussion_email_send(contant,email_id,doctype,docname):
    if email_id:
        parent_doc = frappe.get_doc(doctype,docname)
        args = parent_doc.as_dict()
        args.update({'resone':contant})
        
        template = 'Global Discussion For Document'
        
        if not template:
            frappe.msgprint(frappe._("Please set default template for Discussion."))
            return
        
        email_template = frappe.get_doc("Email Template",template)
        message = frappe.render_template(email_template.response_html,args)
        notify(args,{
            "message":message,
            "message_to":email_id,
            "subject":email_template.subject + " " + docname,
        })
        
@frappe.whitelist()
def get_number_of_leave_days(
	employee: str,
	leave_type: str,
	from_date: str,
	to_date: str,
	half_day: Optional[int] = None,
	half_day_date: Optional[str] = None,
	holiday_list: Optional[str] = None,
) -> float:
	"""Returns number of leave days between 2 dates after considering half day and holidays
	(Based on the include_holiday setting in Leave Type)"""
	number_of_days = 0
	if cint(half_day) == 1:
		if getdate(from_date) == getdate(to_date):
			number_of_days = 0.5
		elif half_day_date and getdate(from_date) <= getdate(half_day_date) <= getdate(to_date):
			number_of_days = date_diff(to_date, from_date) + 0.5
		else:
			number_of_days = date_diff(to_date, from_date) + 1
	else:
		number_of_days = date_diff(to_date, from_date) + 1

	if not frappe.db.get_value("Leave Type", leave_type, "include_holiday"):
		number_of_days = flt(number_of_days) - flt(
			get_holidays(employee, from_date, to_date, holiday_list=holiday_list)
		)
	return number_of_days

@frappe.whitelist()
def get_holidays(employee, from_date, to_date, holiday_list=None):
	"""get holidays between two dates for the given employee"""
	if not holiday_list:
		holiday_list = get_holiday_list_for_employee(employee)

	holidays = frappe.db.sql(
		"""select count(distinct holiday_date) from `tabHoliday` h1, `tabHoliday List` h2
		where h1.parent = h2.name and h1.holiday_date between %s and %s
		and h2.name = %s""",
		(from_date, to_date, holiday_list),
	)[0][0]

	return holidays