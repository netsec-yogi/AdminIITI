# Copyright (c) 2025, CITC IIT Indore and contributors
# For license information, please see license.txt

import json
import frappe
import re
import os
from frappe import _
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
    today
)
from frappe.model.document import Document
from frappe.model.naming import getseries
class TransportAllowance(Document):
    def autoname(self):
        current_year = getdate(today()).year
        prefix = f"IITI-Admin-TPTA-{current_year}"
        x = getseries(prefix,3)
        
        if self.pnt_no:
            self.name = f"IITI/Admin/PNT-{self.pnt_no}/{current_year}/{x}"
        else:
            self.name = f"IITI/Admin/PNT-{x}/{current_year}/{x}"
            
    def on_update(self):
        if self.i_confirm:
            approval_data = frappe.get_doc("Note Sheet Approval Process",self.doctype,as_dict = 1)
            if approval_data.approval_stage:
                for ad in approval_data.approval_stage:
                    if ad.status == self.status:
                        self.share_doc_user(ad.approver_email)
                        self.notify_document(ad.approver_email, 1)
                        
    def share_doc_user(doc, user):
        if not frappe.has_permission(doc=doc, ptype="submit", user=user):
            frappe.share.add_docshare(doc.doctype, doc.name, user, submit=1, flags={"ignore_share_permission": True})
            frappe.msgprint(
                frappe._("Shared with the user {0} with {1} access").format(user, frappe.bold("save"), alert=True))
    
    def notify_document(self, email_id, flags):
        if email_id:
            parent_doc = frappe.get_doc(self.doctype, self.name)
            args = parent_doc.as_dict()

            if flags == 1:
                template = 'Note Sheet Approval for open'
            else:
                template = ''

            if not template:
                frappe.msgprint(frappe._("Please set default template for Note Sheet Approval."))
                return

        email_template = frappe.get_doc("Email Template", template)
        message = frappe.render_template(email_template.response_html, args)
        self.notify({
            "message": message,
            "message_to": email_id,
            "subject": email_template.subject + " " + self.employee_name
        })
        
        
    def notify(self, args):
        args = frappe._dict(args)
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
def update_notesheet_status(doctype, document_name, status, user):
    if user:
        current_date_time = frappe.utils.now_datetime()
        doc = frappe.get_doc(doctype,document_name)
        self = doc
        frappe.db.set_value(doctype, {'name': document_name},{'status': status},update_modified=False)
        if status != 'Approved':
            approver = {
                "comment": "Recommend By " + get_fullname(frappe.session.user),
                "status":status,
                "email": user,
                "datetime": str(current_date_time)  # Ensure datetime is in string format
            }
        else:
            approver = {
                "comment": "Approved By " + get_fullname(frappe.session.user),
                "status":status,
                "email": user,
                "datetime": str(current_date_time)  # Ensure datetime is in string format
            }
        
        # Ensure approver_details is a list (handling JSON)
        if doc.approver_details:
            try:
                approver_list = json.loads(doc.approver_details)
            except json.JSONDecodeError:
                approver_list = []
        else:
            approver_list = []
        
        # Append the new approver
        approver_list.append(approver)
        
        self.approver_details = json.dumps(approver_list)
        self.status = status
        
        # frappe.throw(frappe.as_json(self))
        
        if status != 'Approved':
            doc.save(ignore_permissions=True)
        else:
            doc.submit()
        
        return status
                
                
            
        