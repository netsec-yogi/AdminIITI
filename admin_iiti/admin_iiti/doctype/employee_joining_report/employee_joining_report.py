# Copyright (c) 2022, CITC IIT Indore and contributors
# For license information, please see license.txt

# import frappe
from frappe.model.document import Document
import frappe
from frappe import _
from datetime import date
from frappe.utils import (
    cint,
    get_fullname,
    get_fullname
)


class EmployeeJoiningReport(Document):

    def on_update(self):
        if self.status == 'Open' and self.docstatus < 1:
            approver = self.approver
            delegate_approver = check_delegate(approver)
            if delegate_approver != '':
                self.share_doc_with_approver(approver)
                self.share_doc_with_approver(delegate_approver)
                if frappe.db.get_single_value("HR Settings", "send_leave_notification"):
                    self.notify_joining_email()
                    self.notify_joining_email_delegate(delegate_approver)
            else:
                self.share_doc_with_approver(approver)
                if frappe.db.get_single_value("HR Settings", "send_leave_notification"):
                    self.notify_joining_email()

    def on_submit(self):
        if self.status == "Open":
            frappe.throw(
                _("Only Leave Joining report with status 'Approved' and 'Not approved' and Cancel can be submitted"))

        if self.status == "Approved" or self.status == 'Not Approved':
            self.notify_employee()

        self.reload()

    def notify_joining_email(self):
        if self.approver:
            parent_doc = frappe.get_doc('Employee Joining Report', self.name)
            args = parent_doc.as_dict()

            template = 'Employee Joining Report Approval'
            if not template:
                frappe.msgprint(_("Please set default template for Leave Approval Notification in HR Settings."))
                return
            email_template = frappe.get_doc("Email Template", template)
            message = frappe.render_template(email_template.response, args)
            notify(self, {
                # for post in messages
                "message": message,
                "message_to": self.approver,
                # for email
                "subject": email_template.subject
            })

    def notify_joining_email_delegate(self, email_id):
        if email_id:
            parent_doc = frappe.get_doc('Employee Joining Report', self.name)
            args = parent_doc.as_dict()

            # template = frappe.db.get_single_value('HR Settings', 'leave_approval_notification_template')
            template = 'Employee Joining Report Approval'
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
                "subject": email_template.subject
            })

    def notify_employee(self):
        employee = frappe.get_doc("Employee", self.employee)
        if not employee.user_id:
            return

        parent_doc = frappe.get_doc('Employee Joining Report', self.name)
        args = parent_doc.as_dict()

        # template = frappe.db.get_single_value('HR Settings', 'leave_status_notification_template')
        template = 'Employee Joining Report status notification'
        if not template:
            frappe.msgprint(_("Please set default template for Leave Status Notification in HR Settings."))
            return
        email_template = frappe.get_doc("Email Template", template)
        message = frappe.render_template(email_template.response, args)

        notify(self, {
            # for post in messages
            "message": message,
            "message_to": employee.user_id,
            # for email
            "subject": email_template.subject,
            "notify": "employee"
        })

    def share_doc_with_approver(doc, user):
        if not frappe.has_permission(doc=doc, ptype="submit", user=user):
            frappe.share.add_docshare(doc.doctype, doc.name, user, submit=1,
                                      flags={"ignore_share_permission": True})

            frappe.msgprint(_("Shared with the user {0} with {1} access").format(
                user, frappe.bold("submit"), alert=True))

        # remove shared doc if approver changes
        doc_before_save = doc.get_doc_before_save()
        if doc_before_save:
            approvers = {
                "Employee Joining Report": "joining_report",
                "Shift Request": "approver"
            }

            approver = approvers.get(doc.doctype)
            if doc_before_save.get(approver) != doc.get(approver):
                frappe.share.remove(doc.doctype, doc.name, doc_before_save.get(approver))


def notify(self, args):
    # frappe.throw(frappe.as_json(self))
    args = frappe._dict(args)
    # args -> message, message_to, subject
    if cint(self.follow_via_email):
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
        user = ""
    return user


@frappe.whitelist()
def get_approver_list(txt, searchfield, start, page_len, filters):
    frappe.throw('sss')
