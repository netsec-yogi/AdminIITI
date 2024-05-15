# Copyright (c) 2022, CITC IIT Indore and contributors
# For license information, please see license.txt

# import frappe
from datetime import datetime
import json
from re import template
from hrms.hr.doctype.leave_application.leave_application import LeaveApplication
import frappe
from frappe.model.document import Document
from frappe import _, as_json, utils
from hrms.hr.utils import (
    share_doc_with_approver

)
import math
from erpnext.setup.doctype.employee.employee import get_holiday_list_for_employee
from frappe.utils import (
    cint,
    get_fullname,
    add_days,
    cstr,
    date_diff,
    flt,
    formatdate,
    get_fullname,
    get_link_to_form,
    getdate,
    nowdate,
    now_datetime
)
from erpnext.accounts.utils import get_fiscal_year
from frappe.model.naming import getseries


class LTCRequest(Document):
    def autoname(self):
        # p:this function used for create the custom auto name series
        prefix = 'p-{}-'.format('IIT-Admin-PNT-2024-')
        x = getseries(prefix, 4)
        
        #frappe.throw(frappe.as_json(x))
        # current_fiscal_year = get_fiscal_year(nowdate(), as_dict=True)
        current_year = now_datetime().year
        #self.name = f"IIT/Admin/PNT-{x}/{current_year}"

    def on_update(self):
        # p:LTC form is create document send to hr dealing user
        # p:defalut document status is open set .
        if self.status == "Open" and self.docstatus < 1:
            HRDealing = frappe.db.get_list('User', fields=["`tabHas Role`.*"], filters=[['User', 'enabled', '=', 1],
                                                                                        ["Has Role", "role", "=",
                                                                                         'HR Dealing Assistant']])
            if HRDealing:
                for id in HRDealing:
                    self.share_doc_user(id.parent)
                    self.notify_email_Ltc_request(id.parent, 1)
        # p:when the status change open to processed ,document share with the HR User.
        if self.status == "Processed":
            HRusers = frappe.db.get_list('User', fields=["`tabHas Role`.*"],
                                         filters=[['User', 'enabled', '=', 1], ["Has Role", "role", "=", 'HR User']])
            for i in HRusers:
                self.share_doc_user(i.parent)
                self.notify_email_Ltc_request(i.parent, 2)
        if self.status == "Checked":
            HRManager = frappe.db.get_list('User', fields=["`tabHas Role`.*"], filters=[['User', 'enabled', '=', 1],
                                                                                        ["Has Role", "role", "=",
                                                                                         'HR Manager']])

            if HRManager:
                for manager in HRManager:
                    self.share_doc_user(manager.parent)
                    self.notify_email_Ltc_request(manager.parent, 3)
        if self.status == "Recommended":
            self.notify_leave_approver()
            share_doc_with_approver(self, self.approver)
            # notify leave approver about creation
        ##if frappe.db.get_single_value("HR Settings", "send_leave_notification"):

    def on_submit(self):
        if self.status == "Open":
            frappe.throw(_("Only LTC Request Form  with status 'Approved' and 'Rejected' can be submitted"))

        self.notify_employee()
        email_array = []
        email_array.append(self.ltc_processed_by)
        email_array.append(self.ltc_checked_by)
        email_array.append(self.ltc_recommended_by)

        for email in range(len(email_array)):
            self.notify_email_Ltc_request(email_array[email], 4)

        if self.leave_encashment:
            if self.status == 'Sanction':
                El_update(self)

        # self.create_leave_ledger_entry()

        self.reload()

    def share_doc_user(doc, user):
        # p:this code used for document share to the users
        if not frappe.has_permission(doc=doc, ptype="write", user=user):
            frappe.share.add_docshare(doc.doctype, doc.name, user, write=1, flags={"ignore_share_permission": True})
            frappe.msgprint(
                frappe._("Shared with the user {0} with {1} access").format(user, frappe.bold("save"), alert=True))

    def notify_email_Ltc_request(self, email_id, flags):
        # p:this method used for email send to all users depend on the which flag pass
        # 1=>HR User 2=>HR Manager (Administrator)
        # frappe.throw(frappe.as_json(flags))
        if email_id:
            parent_doc = frappe.get_doc('LTC Request', self.name)
            args = parent_doc.as_dict()

            if flags == 1:
                template = 'LTC Request Notification FOR HR Dealing Assistant'
            elif flags == 2:
                template = 'LTC Request notification for HR User'
            elif flags == 3:
                template = 'LTC Request notification for HR Manager'
            elif flags == 4:
                template = 'LTC Request Status Sanction Notification'
            else:
                template = ''

            if not template:
                frappe.msgprint(frappe._("Please set default template for LTC Request ."))
                return

        email_template = frappe.get_doc("Email Template", template)
        message = frappe.render_template(email_template.response_html, args)
        self.notify({
            "message": message,
            "message_to": email_id,
            "subject": email_template.subject + " " + self.employee_name
        })

    def notify_employee(self):
        # p:retrun email send to employee when the document is approved .
        employee = frappe.get_doc("Employee", self.employee)
        if not employee.user_id:
            return

        parent_doc = frappe.get_doc('LTC Request', self.name)
        args = parent_doc.as_dict()

        # template = frappe.db.get_single_value('HR Settings', 'leave_status_notification_template')
        template = 'LTC Request Status Notification'
        if not template:
            frappe.msgprint(_("Please set default template for Leave Status Notification in HR Settings."))
            return

        email_template = frappe.get_doc("Email Template", template)
        message = frappe.render_template(email_template.response_html, args)

        self.notify({
            # for post in messages
            "message": message,
            "message_to": employee.user_id,
            # for email
            "subject": email_template.subject,
            "notify": "employee"
        })

    def notify_leave_approver(self):
        if self.approver:
            parent_doc = frappe.get_doc('LTC Request', self.name)
            args = parent_doc.as_dict()
            # template = frappe.db.get_single_value('HR Settings', 'leave_approval_notification_template')
            # if not template:
            # 	frappe.msgprint(_("Please set default template for Leave Approval Notification in HR Settings."))
            # 	return
            template = 'LTC Request Notification'
            email_template = frappe.get_doc("Email Template", template)
            message = frappe.render_template(email_template.response_html, args)

            self.notify({
                # for post in messages
                "message": message,
                "message_to": self.approver,
                # for email
                "subject": email_template.subject
            })

    def notify(self, args):
        args = frappe._dict(args)

        contact = args.message_to
        if not isinstance(contact, list):
            if not args.notify == "employee":
                contact = frappe.get_doc('User', contact).email or contact

            sender = dict()
            sender['email'] = frappe.get_doc('User', frappe.session.user).email
            sender['full_name'] = get_fullname(sender['email'])

            try:
                frappe.sendmail(
                    recipients=contact,
                    sender=sender['email'],
                    subject=args.subject,
                    message=args.message,
                )
                frappe.msgprint(_("Email sent to {0}").format(contact))
            except frappe.OutgoingEmailError:
                pass
            # args -> message, message_to, subject
            ##if cint(self.follow_via_email):


def El_update(self):
    leave_type_name = 'Earned Leave'

    El_balance = get_leave_balance_on(self.employee, leave_type_name, self.departure_date, self.arrival_date,
                                      consider_all_leaves_in_the_allocation_period=True)

    # if self.leave_application:
    # 	LeaveApplication_data = frappe.db.get_value("Leave Application",{"name":self.leave_application},["employee","total_leave_days"],as_dict=True)

    # El_balance = frappe.db.get_value("Leave Allocation",{"employee":self.employee,"leave_type_name": 'Earned Leave'},"total_leaves_allocated",as_dict=1)

    #:p EL Leave application Create

    El = frappe.new_doc("Leave Application")
    El.employee = self.employee
    El.employee_name = self.employee_name
    El.leave_type = 'Earned Leave'
    El.department = self.department
    El.leave_balance = El_balance
    El.from_date = self.departure_date
    El.to_date = self.arrival_date
    El.total_leave_days = self.encashment_days
    El.status = 'Approved'
    El.leave_approver = frappe.session.user
    El.leave_type_name = 'Earned Leave'
    El.flags.ignore_validate = True
    El.flags.ignore_permissions = 1
    El.docstatus = 1
    El.description = 'LTC Applied'
    # frappe.throw(frappe.as_json(El))
    El.db_insert()

    El_application = frappe.get_last_doc('Leave Application')

    new_El_balance = self.encashment_days

    if El_application:
        doc = frappe.new_doc("Leave Ledger Entry")
        doc.employee = self.employee
        doc.employee_name = self.employee_name
        doc.leave_type = 'Earned Leave'
        doc.transaction_type = 'Leave Application'
        doc.transaction_name = El_application.name
        doc.leaves = new_El_balance * -1
        doc.company = 'IITI'
        doc.from_date = self.departure_date
        doc.to_date = self.arrival_date
        doc.holiday_list = get_holiday_list_for_employee(self.employee, raise_exception=True) or ''
        doc.flags.ignore_validate = True
        doc.flags.ignore_permissions = 1
        doc.docstatus = 1
        ##frappe.throw(frappe.as_json(doc))
        doc.db_insert()


@frappe.whitelist()
def get_leave_balance_on(employee, leave_type, date, to_date=None, consider_all_leaves_in_the_allocation_period=False):
    '''
        Returns leave balance till date
        :param employee: employee name
        :param leave_type: leave type
        :param date: date to check balance on
        :param to_date: future date to check for allocation expiry
        :param consider_all_leaves_in_the_allocation_period: consider all leaves taken till the allocation end date
    '''

    if not to_date:
        to_date = nowdate()

    allocation_records = get_leave_allocation_records(employee, date, leave_type)
    allocation = allocation_records.get(leave_type, frappe._dict())

    end_date = allocation.to_date if consider_all_leaves_in_the_allocation_period else date
    expiry = get_allocation_expiry(employee, leave_type, to_date, date)

    leaves_taken = get_leaves_for_period(employee, leave_type, allocation.from_date, end_date)

    return get_remaining_leaves(allocation, leaves_taken, date, expiry)


def get_leave_allocation_records(employee, date, leave_type=None):
    ''' returns the total allocated leaves and carry forwarded leaves based on ledger entries '''

    conditions = ("and leave_type='%s'" % leave_type) if leave_type else ""
    allocation_details = frappe.db.sql("""
        SELECT
            SUM(CASE WHEN is_carry_forward = 1 THEN leaves ELSE 0 END) as cf_leaves,
            SUM(CASE WHEN is_carry_forward = 0 THEN leaves ELSE 0 END) as new_leaves,
            MIN(from_date) as from_date,
            MAX(to_date) as to_date,
            leave_type
        FROM `tabLeave Ledger Entry`
        WHERE
            from_date <= %(date)s
            AND to_date >= %(date)s
            AND docstatus=1
            AND transaction_type="Leave Allocation"
            AND employee=%(employee)s
            AND is_expired=0
            AND is_lwp=0
            {0}
        GROUP BY employee, leave_type
    """.format(conditions), dict(date=date, employee=employee), as_dict=1)  # nosec

    allocated_leaves = frappe._dict()
    for d in allocation_details:
        allocated_leaves.setdefault(d.leave_type, frappe._dict({
            "from_date": d.from_date,
            "to_date": d.to_date,
            "total_leaves_allocated": flt(d.cf_leaves) + flt(d.new_leaves),
            "unused_leaves": d.cf_leaves,
            "new_leaves_allocated": d.new_leaves,
            "leave_type": d.leave_type
        }))
    return allocated_leaves


def get_pending_leaves_for_period(employee, leave_type, from_date, to_date):
    ''' Returns leaves that are pending approval '''
    leaves = frappe.get_all("Leave Application",
                            filters={
                                "employee": employee,
                                "leave_type": leave_type,
                                "status": "Open"
                            },
                            or_filters={
                                "from_date": ["between", (from_date, to_date)],
                                "to_date": ["between", (from_date, to_date)]
                            }, fields=['SUM(total_leave_days) as leaves'])[0]
    return leaves['leaves'] if leaves['leaves'] else 0.0


def get_remaining_leaves(allocation, leaves_taken, date, expiry):
    ''' Returns minimum leaves remaining after comparing with remaining days for allocation expiry '''

    def _get_remaining_leaves(remaining_leaves, end_date):

        if remaining_leaves > 0:
            remaining_days = date_diff(end_date, date) + 1
            remaining_leaves = min(remaining_days, remaining_leaves)

        return remaining_leaves

    total_leaves = flt(allocation.total_leaves_allocated) + flt(leaves_taken)

    if expiry and allocation.unused_leaves:
        remaining_leaves = flt(allocation.unused_leaves) + flt(leaves_taken)
        remaining_leaves = _get_remaining_leaves(remaining_leaves, expiry)

        total_leaves = flt(allocation.new_leaves_allocated) + flt(remaining_leaves)

    return _get_remaining_leaves(total_leaves, allocation.to_date)


def get_leaves_for_period(employee, leave_type, from_date, to_date, do_not_skip_expired_leaves=False):
    leave_entries = get_leave_entries(employee, leave_type, from_date, to_date)
    leave_days = 0

    for leave_entry in leave_entries:
        inclusive_period = leave_entry.from_date >= getdate(from_date) and leave_entry.to_date <= getdate(to_date)

        if inclusive_period and leave_entry.transaction_type == 'Leave Encashment':
            leave_days += leave_entry.leaves

        elif inclusive_period and leave_entry.transaction_type == 'Leave Allocation' and leave_entry.is_expired \
                and (do_not_skip_expired_leaves or not skip_expiry_leaves(leave_entry, to_date)):
            leave_days += leave_entry.leaves

        elif leave_entry.transaction_type == 'Leave Application':
            if leave_entry.from_date < getdate(from_date):
                leave_entry.from_date = from_date
            if leave_entry.to_date > getdate(to_date):
                leave_entry.to_date = to_date

            half_day = 0
            half_day_date = None
            # fetch half day date for leaves with half days
            if leave_entry.leaves % 1:
                half_day = 1
                half_day_date = frappe.db.get_value('Leave Application',
                                                    {'name': leave_entry.transaction_name}, ['half_day_date'])

            leave_days += get_number_of_leave_days(employee, leave_type,
                                                   leave_entry.from_date, leave_entry.to_date, half_day, half_day_date,
                                                   holiday_list=leave_entry.holiday_list) * -1

    return leave_days


def get_allocation_expiry(employee, leave_type, to_date, from_date):
    ''' Returns expiry of carry forward allocation in leave ledger entry '''
    expiry = frappe.get_all("Leave Ledger Entry",
                            filters={
                                'employee': employee,
                                'leave_type': leave_type,
                                'is_carry_forward': 1,
                                'transaction_type': 'Leave Allocation',
                                'to_date': ['between', (from_date, to_date)]
                            }, fields=['to_date'])
    return expiry[0]['to_date'] if expiry else None


def get_leave_entries(employee, leave_type, from_date, to_date):
    ''' Returns leave entries between from_date and to_date. '''
    return frappe.db.sql("""
        SELECT
            employee, leave_type, from_date, to_date, leaves, transaction_name, transaction_type, holiday_list,
            is_carry_forward, is_expired
        FROM `tabLeave Ledger Entry`
        WHERE employee=%(employee)s AND leave_type=%(leave_type)s
            AND docstatus=1
            AND (leaves<0
                OR is_expired=1)
            AND (from_date between %(from_date)s AND %(to_date)s
                OR to_date between %(from_date)s AND %(to_date)s
                OR (from_date < %(from_date)s AND to_date > %(to_date)s))
    """, {
        "from_date": from_date,
        "to_date": to_date,
        "employee": employee,
        "leave_type": leave_type
    }, as_dict=1)


def skip_expiry_leaves(leave_entry, date):
    ''' Checks whether the expired leaves coincide with the to_date of leave balance check.
        This allows backdated leave entry creation for non carry forwarded allocation '''
    end_date = frappe.db.get_value("Leave Allocation", {'name': leave_entry.transaction_name}, ['to_date'])
    return True if end_date == date and not leave_entry.is_carry_forward else False


def get_leave_entries(employee, leave_type, from_date, to_date):
    ''' Returns leave entries between from_date and to_date. '''
    return frappe.db.sql("""
        SELECT
            employee, leave_type, from_date, to_date, leaves, transaction_name, transaction_type, holiday_list,
            is_carry_forward, is_expired
        FROM `tabLeave Ledger Entry`
        WHERE employee=%(employee)s AND leave_type=%(leave_type)s
            AND docstatus=1
            AND (leaves<0
                OR is_expired=1)
            AND (from_date between %(from_date)s AND %(to_date)s
                OR to_date between %(from_date)s AND %(to_date)s
                OR (from_date < %(from_date)s AND to_date > %(to_date)s))
    """, {
        "from_date": from_date,
        "to_date": to_date,
        "employee": employee,
        "leave_type": leave_type
    }, as_dict=1)


@frappe.whitelist()
def get_number_of_leave_days(employee, leave_type, from_date, to_date, half_day=None, half_day_date=None,
                             holiday_list=None):
    number_of_days = 0
    if cint(half_day) == 1:
        if from_date == to_date:
            number_of_days = 0.5
        elif half_day_date and half_day_date <= to_date:
            number_of_days = date_diff(to_date, from_date) + .5
        else:
            number_of_days = date_diff(to_date, from_date) + 1

    else:
        number_of_days = date_diff(to_date, from_date) + 1

    if not frappe.db.get_value("Leave Type", leave_type, "include_holiday"):
        number_of_days = flt(number_of_days) - flt(
            get_holidays(employee, from_date, to_date, holiday_list=holiday_list))
    return number_of_days


@frappe.whitelist()
def get_holidays(employee, from_date, to_date, holiday_list=None):
    '''get holidays between two dates for the given employee'''
    if not holiday_list:
        holiday_list = get_holiday_list_for_employee(employee)

    holidays = frappe.db.sql("""select count(distinct holiday_date) from `tabHoliday` h1, `tabHoliday List` h2
        where h1.parent = h2.name and h1.holiday_date between %s and %s
        and h2.name = %s""", (from_date, to_date, holiday_list))[0][0]

    return holidays


@frappe.whitelist()
def update_LTC_status(doctype, document_name, status, user):
    current_date_time = frappe.utils.now_datetime()

    if status == 'Processed':
        frappe.db.set_value(doctype, {'name': document_name},
                            {'ltc_processed_by': user, 'ltc_processed_date_time': current_date_time},
                            update_modified=False)
    elif status == 'Checked':
        frappe.db.set_value(doctype, {'name': document_name},
                            {'ltc_checked_by': user, 'ltc_checked_date_time': current_date_time}, update_modified=False)
    elif status == 'Recommended':
        frappe.db.set_value(doctype, {'name': document_name},
                            {'ltc_recommended_by': user, 'ltc_recommended_date_time': current_date_time},
                            update_modified=False)
    elif status == 'Sanction':
        frappe.db.set_value(doctype, {'name': document_name},
                            {'ltc_approved_by': user, 'ltc_approved_date_time': current_date_time},
                            update_modified=False)
    elif status == 'Rejected':
        frappe.db.set_value(doctype, {'name': document_name},
                            {'ltc_approved_by': user, 'ltc_approved_date_time': current_date_time},
                            update_modified=False)

    # frappe.throw(frappe.as_json(doc))

    return status

@frappe.whitelist()
def cancel_doc(contant,email_id,doctype,docname,action):
    if action == 'Cancelled':
        doc = frappe.get_doc(doctype,docname)
        data = frappe.db.set_value(doctype,{'name':docname},{'docstatus':1},update_modified = False)
        data = frappe.db.set_value(doctype,{'name':docname},{'docstatus':2,'status':action},update_modified = False)
        frappe.db.commit()
        message = 'update'
    else:
        message = 'error'
        
    return message
