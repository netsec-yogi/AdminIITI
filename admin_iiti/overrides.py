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


from hrms.hr.doctype.leave_application.leave_application import LeaveApplication


# from hrms.hr.doctype.leave_application.leave_application import  *


class CustomLeaveApplication(Document):

    def on_update(self):
        if frappe.db.get_value("Leave Type", self.leave_type, "is_optional_leave"):
            self.validate_optional_leave()
        if self.status == "Open" and self.docstatus < 1:
            # self.after_insert_recommeder()
            count_recommender = self.validate_recommender_entry()
            self.send_share_leave_notice()
        # frappe.msgprint("\n \n \n",count_recommender,"\n\n\n")

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

    def create_leave_ledger_entry(self, submit=True):

        if self.status != 'Approved' and submit:
            return

        # p:leave ledger entry update for paternity leave

        if self.from_date:
            current_date = self.from_date
        else:
            current_date = self.posting_date

        if self.leave_type_name == 'Paternity Leave':
            allocated_data = frappe.db.get_value("Leave Allocation",
                                                 {"employee": self.employee, "leave_type_name": self.leave_type_name,
                                                  'from_date': ('<=', self.posting_date),
                                                  'to_date': ('>=', self.posting_date)}, "name", as_dict=1)

            frappe.db.set_value("Leave Ledger Entry",
                                {'employee': self.employee, 'transaction_type': 'Leave Allocation',
                                 'transaction_name': allocated_data.name}, {'is_expired': 1}, update_modified=False)

        # p:End ledger entry update for paternity leave

        # expiry_date = get_allocation_expiry(self.employee, self.leave_type,
        # self.to_date, self.from_date)

        expiry = frappe.get_all("Leave Ledger Entry",
                                filters={
                                    'employee': self.employee,
                                    'leave_type': self.leave_type,
                                    'is_carry_forward': 1,
                                    'transaction_type': 'Leave Allocation',
                                    'to_date': ['between', (self.from_date, self.to_date)]
                                }, fields=['to_date'])
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
            if self.leave_type_name == 'Commuted Leave':
                HPL_balance_minus(self)
            elif self.leave_type_name == 'Half Paid Leave':
                HPL_balance_minus(self)
            else:
                create_leave_ledger_entry(self, args, submit)

    def validate_recommender_entry(self):
        if self.leave_recommender and not self.leave_recommender_second and not self.leave_recommender_third:
            flag = 1
            return 1
        elif self.leave_recommender and self.leave_recommender_second and not self.leave_recommender_third:
            flag = 2
            return 2
        elif self.leave_recommender and self.leave_recommender_second and self.leave_recommender_third:
            flag = 3
            return 3
        elif not self.leave_recommender and not self.leave_recommender_second and not self.leave_recommender_third:
            flag = 4
            return 4
        else:
            frappe.throw("ALERT:Recommendation authority is not set properly!!")
            return 0

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

    def send_share_leave_notice(self):

        leave_approver = self.leave_approver
        leave_recommender = self.leave_recommender
        leave_recommender_second = self.leave_recommender_second
        leave_recommender_third = self.leave_recommender_third

        leave_delegate_recommender = check_delegate(self.leave_recommender)
        leave_delegate_recommender_second = check_delegate(self.leave_recommender_second)
        leave_delegate_recommender_third = check_delegate(self.leave_recommender_third)
        leave_delegate_approver = check_delegate(self.leave_approver)

        # frappe.throw(leave_delegate_approver)
        # if total recommender 3, then the doc share to the three recommender
        # frappe.msgprint(frappe.as_json(self.total_recommender))

        # p: share doc 0 = recommender and 1 = approver

        if self.status != 'Approved':
            # frappe.msgprint(frappe.as_json(self.total_recommender))
            if self.total_recommender == 3:
                # frappe.throw('recommender 3')
                if self.recommender_first and self.recommender_second and self.recommender_third:
                    # if all three recommender are  recommended the status is set Recommended
                    frappe.db.set_value("Leave Application", self.name, 'status', 'Recommended', update_modified=False)
                    if leave_delegate_approver:
                        share_doc_with_approver(self, leave_approver)
                        share_doc_with_approver(self, leave_delegate_approver)
                        if frappe.db.get_single_value("HR Settings", "send_leave_notification"):
                            notify_leave_approver(self)
                            notify_leave_email(self, leave_delegate_approver)
                    else:
                        share_doc_with_approver(self, leave_approver)
                        if frappe.db.get_single_value("HR Settings", "send_leave_notification"):
                            notify_leave_approver(self)

                elif self.recommender_first and self.recommender_second:
                    if leave_delegate_recommender_third:
                        share_doc_with_recommender(self, leave_delegate_recommender_third)
                        share_doc_with_recommender(self, leave_recommender_third)
                        if frappe.db.get_single_value("HR Settings", "send_leave_notification"):
                            notify_leave_email(self, leave_delegate_recommender_third)
                            notify_leave_email(self, leave_recommender_third)
                    else:
                        share_doc_with_recommender(self, leave_recommender_third)
                        if frappe.db.get_single_value("HR Settings", "send_leave_notification"):
                            notify_leave_email(self, leave_recommender_third)
                elif self.recommender_first:
                    if leave_delegate_recommender_second:
                        share_doc_with_recommender(self, leave_delegate_recommender_second)
                        share_doc_with_recommender(self, leave_recommender_second)
                        if frappe.db.get_single_value("HR Settings", "send_leave_notification"):
                            notify_leave_email(self, leave_delegate_recommender_second)
                            notify_leave_email(self, leave_recommender_second)
                    else:
                        share_doc_with_recommender(self, leave_recommender_second)
                        if frappe.db.get_single_value("HR Settings", "send_leave_notification"):
                            notify_leave_email(self, leave_recommender_second)
                else:
                    if leave_delegate_recommender:
                        share_doc_with_recommender(self, leave_delegate_recommender)
                        share_doc_with_recommender(self, leave_recommender)
                        if frappe.db.get_single_value("HR Settings", "send_leave_notification"):
                            notify_leave_email(self, leave_delegate_recommender)
                            notify_leave_email(self, leave_recommender)
                    else:
                        share_doc_with_recommender(self, leave_recommender)
                        if frappe.db.get_single_value("HR Settings", "send_leave_notification"):
                            notify_leave_email(self, leave_recommender)

            # if total recommender 2, then the doc share to the two recommender
            elif self.total_recommender == 2:
                if self.recommender_first and self.recommender_second:
                    # if all two recommender are  recommended  the status is set Recommended
                    frappe.db.set_value("Leave Application", self.name, 'status', 'Recommended', update_modified=False)
                    if leave_delegate_approver:
                        share_doc_with_approver(self, leave_approver)
                        share_doc_with_approver(self, leave_delegate_approver)
                        if frappe.db.get_single_value("HR Settings", "send_leave_notification"):
                            notify_leave_approver(self)
                            notify_leave_email(self, leave_delegate_approver)
                    else:
                        share_doc_with_approver(self, leave_approver)
                        if frappe.db.get_single_value("HR Settings", "send_leave_notification"):
                            notify_leave_approver(self)
                elif self.recommender_first:
                    if leave_delegate_recommender_second:
                        share_doc_with_recommender(self, leave_delegate_recommender_second)
                        share_doc_with_recommender(self, leave_recommender_second)
                        if frappe.db.get_single_value("HR Settings", "send_leave_notification"):
                            notify_leave_email(self, leave_delegate_recommender_second)
                            notify_leave_email(self, leave_recommender_second)
                    else:
                        share_doc_with_recommender(self, leave_recommender_second)
                        if frappe.db.get_single_value("HR Settings", "send_leave_notification"):
                            notify_leave_email(self, leave_recommender_second)
                else:
                    if leave_delegate_recommender:
                        share_doc_with_recommender(self, leave_delegate_recommender)
                        share_doc_with_recommender(self, leave_recommender)
                        if frappe.db.get_single_value("HR Settings", "send_leave_notification"):
                            notify_leave_email(self, leave_delegate_recommender)
                            notify_leave_email(self, leave_recommender)
                    else:
                        share_doc_with_recommender(self, leave_recommender)
                        if frappe.db.get_single_value("HR Settings", "send_leave_notification"):
                            notify_leave_email(self, leave_recommender)
            # if total recommender one, then the doc share to the one recommender
            elif self.total_recommender == 1:
                if self.recommender_first:
                    # if all one recommender are recommended the status is set Recommended
                    frappe.db.set_value("Leave Application", self.name, 'status', 'Recommended', update_modified=False)
                    if leave_delegate_approver:
                        share_doc_with_approver(self, leave_approver)
                        share_doc_with_approver(self, leave_delegate_approver)
                        if frappe.db.get_single_value("HR Settings", "send_leave_notification"):
                            # frappe.throw("Delegate site")
                            notify_leave_approver(self)
                            notify_leave_email(self, leave_delegate_approver)
                    else:
                        share_doc_with_approver(self, leave_approver)
                        if frappe.db.get_single_value("HR Settings", "send_leave_notification"):
                            notify_leave_approver(self)
                else:
                    if leave_delegate_recommender:
                        share_doc_with_recommender(self, leave_delegate_recommender)
                        share_doc_with_recommender(self, leave_recommender)
                        if frappe.db.get_single_value("HR Settings", "send_leave_notification"):
                            notify_leave_email(self, leave_delegate_recommender)
                            notify_leave_email(self, leave_recommender)
                    else:
                        share_doc_with_recommender(self, leave_recommender)
                        if frappe.db.get_single_value("HR Settings", "send_leave_notification"):
                            notify_leave_email(self, leave_recommender)

            elif self.total_recommender == 0:
                if self.status == "Open" and self.docstatus < 1:
                    if leave_delegate_approver:
                        # frappe.throw('leave_delegate_approver')
                        share_doc_with_approver(self, leave_approver)
                        share_doc_with_approver(self, leave_delegate_approver)
                        if frappe.db.get_single_value("HR Settings", "send_leave_notification"):
                            notify_leave_approver(self)
                            notify_leave_email(self, leave_delegate_approver)
                    else:
                        share_doc_with_approver(self, leave_approver)
                        if frappe.db.get_single_value("HR Settings", "send_leave_notification"):
                            notify_leave_approver(self)
                else:
                    share_doc_with_approver(self, leave_approver)
                    if frappe.db.get_single_value("HR Settings", "send_leave_notification"):
                        notify_leave_approver(self)
    # else:
    # 	frappe.throw('now approved')


@frappe.whitelist()
def set_leave_status(leave_application_name, action_type, total_recommender, recommender_first, recommender_second,
                     recommender_third, leave_type, leave_data):
    # return action_type
    if action_type == 'recommond':
        if recommender_first == "1":
            frappe.db.set_value("Leave Application", {'name': leave_application_name}, {'recommender_first': 1},
                                update_modified=False)
        # if total_recommender=="1":
        # 	frappe.db.set_value("Leave Application",{"name":leave_application_name}, {'status':'Recommended'},update_modified=False)

        if recommender_second == "1":
            frappe.db.set_value("Leave Application", {'name': leave_application_name}, {'recommender_second': 1},
                                update_modified=False)
        # if total_recommender=="2":
        # 	frappe.db.set_value("Leave Application",{"name":leave_application_name}, {'status':'Recommended'},update_modified=False)

        if recommender_third == "1":
            frappe.db.set_value("Leave Application", {'name': leave_application_name}, {'recommender_third': 1},
                                update_modified=False)
        # if total_recommender=="3":
        # 	frappe.db.set_value("Leave Application",{"name":leave_application_name}, {'status':'Recommended'},update_modified=False)

    if action_type == "not_recommond" or action_type == "not_approved":
        frappe.db.set_value("Leave Application", {"name": leave_application_name}, {'status': 'Rejected'},
                            update_modified=False)

    ##frappe.db.set_value("Leave Application",'HR-LAP-2022-00117','status','Rejected', update_modified=False)

    if action_type == 'approved':
        # pass
        frappe.db.set_value("Leave Application", {"name": leave_application_name}, {'status': 'Approved'},
                            update_modified=False)

    return action_type


def get_allocation_expiry_for_cf_leaves(
        employee: str, leave_type: str, to_date: str, from_date: str
) -> str:
    """Returns expiry of carry forward allocation in leave ledger entry"""
    expiry = frappe.get_all(
        "Leave Ledger Entry",
        filters={
            "employee": employee,
            "leave_type": leave_type,
            "is_carry_forward": 1,
            "transaction_type": "Leave Allocation",
            "to_date": ["between", (from_date, to_date)],
            "docstatus": 1,
        },
        fields=["to_date"],
    )
    return expiry[0]["to_date"] if expiry else ""


@frappe.whitelist()
def notify_leave_approver(self):
    # frappe.msgprint("Notify")
    if self.leave_approver:
        parent_doc = frappe.get_doc("Leave Application", self.name)
        args = parent_doc.as_dict()

        template = frappe.db.get_single_value("HR Settings", "leave_approval_notification_template")
        if not template:
            frappe.msgprint(
                _("Please set default template for Leave Approval Notification in HR Settings.")
            )
            return
        email_template = frappe.get_doc("Email Template", template)
        message = frappe.render_template(email_template.response_html, args)

        notify(self,
               {
                   # for post in messages
                   "message": message,
                   "message_to": self.leave_approver,
                   # for email
                   # "subject": email_template.subject,
                   "subject": email_template.subject + " " + self.employee_name + " from " + self.from_date + " to " + self.to_date,
               }
               )


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
def check_delegate(user):
    today = date.today()
    values = {'owner': user, "today": today}

    check_delegate = frappe.db.sql(
        "SELECT delegate_to FROM `tabDelegate Responsibility`  WHERE %(today)s BETWEEN from_date AND to_date and owner=%(owner)s",
        values=values, as_dict=True)

    if check_delegate:
        user = check_delegate[0].delegate_to
    else:
        user = None
    return user


@frappe.whitelist()
def get_employee_by_position(emp_main_department, postion_department, position):
    if position == "HOD":
        values = {'department': emp_main_department, "position": position}
        employee_postion_detail = frappe.db.sql(
            "SELECT epd.*,e.user_id FROM `tabEmployee Position Details` as epd INNER JOIN `tabEmployee` as e on epd.parent=e.name WHERE epd.department=%(department)s and epd.position=%(position)s",
            values=values, as_dict=True)
        return employee_postion_detail
    else:
        values = {"position": position, 'department': emp_main_department}
        employee_postion_detail = frappe.db.sql(
            "SELECT epd.*,e.user_id FROM `tabEmployee Position Details` as epd INNER JOIN `tabEmployee` as e on epd.parent=e.name WHERE epd.position=%(position)s and epd.department=%(department)s ",
            values=values, as_dict=True)
        return employee_postion_detail


def notify_leave_email(self, email_id):
    if email_id:
        parent_doc = frappe.get_doc('Leave Application', self.name)
        args = parent_doc.as_dict()

        template = frappe.db.get_single_value(
            'HR Settings', 'leave_approval_notification_template')
        if not template:
            frappe.msgprint(_("Please set default template for Leave Approval Notification in HR Settings."))

            return
        email_template = frappe.get_doc("Email Template", template)
        message = frappe.render_template(email_template.response, args)
        notify(self, {
            # for post in messages
            "message": message,
            "message_to": email_id,
            # for email
            "subject": email_template.subject + " " + self.employee_name + " from " + self.from_date + " to " + self.to_date,
        })


# total recommeder count function
def after_insert_recommeder(doc, method):
    data = doc.total_recommender
    if doc.leave_recommender and not doc.leave_recommender_second and not doc.leave_recommender_third:
        data = 1
    if doc.leave_recommender and doc.leave_recommender_second and not doc.leave_recommender_third:
        # frappe.throw('2')
        data = 2
    if doc.leave_recommender and doc.leave_recommender_second and doc.leave_recommender_third:
        # frappe.throw('3')
        data = 3

    if not doc.leave_recommender and not doc.leave_recommender_second and not doc.leave_recommender_third:
        # frappe.throw('0')
        data = 0

    doc.total_recommender = data
    doc.update({"doc.total_recommender": data})


# doc.save()
# End total recommeder count function
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


@frappe.whitelist()
def get_approvers_old(doctype, txt, searchfield, start, page_len, filters):
    approvers = frappe.db.sql(
        """select u.name,u.first_name,u.last_name from `tabUser` u INNER JOIN `tabEmployee` e ON u.name = e.user_id""")
    return set(tuple(approver) for approver in approvers)


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
def get_approvers_oldone(doctype, txt, searchfield, start, page_len, filters):
    doctype = "Employee"
    conditions = []
    fields = get_fields(doctype, ["user_id", "employee_name"])

    return frappe.db.sql(
        """select {fields} from `tabEmployee`
		where status in ('Active', 'Suspended')
			and docstatus < 2
			and ({key} like %(txt)s
				or employee_name like %(txt)s)
			{fcond} {mcond}
		order by
			(case when locate(%(_txt)s, name) > 0 then locate(%(_txt)s, name) else 99999 end),
			(case when locate(%(_txt)s, employee_name) > 0 then locate(%(_txt)s, employee_name) else 99999 end),
			idx desc,
			name, employee_name
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
def update_website_context(context):
    context.update(dict(
        splash_image='/files/iiti-splash.png'
    ))
    return context

@frappe.whitelist()
def cancel_leave_application(employee,doctype,docname,status):
    if status == 'Cancelled':
        data = frappe.db.set_value(doctype, {"name": docname}, {'status': status,'docstatus':2},update_modified=False)
    
    return data


@frappe.whitelist()
def get_fields(doctype, fields=None):
    if fields is None:
        fields = []
    meta = frappe.get_meta(doctype)
    fields.extend(meta.get_search_fields())

    if meta.title_field and not meta.title_field.strip() in fields:
        fields.insert(1, meta.title_field.strip())

    return unique(fields)


def share_doc_with_recommender(doc, user):
    # if approver does not have permissions, share
    if not frappe.has_permission(doc=doc, ptype="write", user=user):
        frappe.share.add_docshare(doc.doctype, doc.name, user, write=1,
                                  flags={"ignore_share_permission": True})

        frappe.msgprint(_("Shared with the user {0} with {1} access").format(
            user, frappe.bold("submit"), alert=True))

    # remove shared doc if approver changes
    doc_before_save = doc.get_doc_before_save()
    if doc_before_save:
        approvers = {
            "Leave Application": "leave_recommender",
            "Expense Claim": "expense_approver",
            "Shift Request": "approver"
        }

        approver = approvers.get(doc.doctype)
        if doc_before_save.get(approver) != doc.get(approver):
            frappe.share.remove(doc.doctype, doc.name, doc_before_save.get(approver))
