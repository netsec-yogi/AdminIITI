# Copyright (c) 2023, CITC IIT Indore and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
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
import json
from frappe import _

class LTCOfficeMemorandum(Document):
    def on_update(self):
        mail_user = frappe.db.get_list("Note Sheets Email", filters={'status':'Active','document_name':self.doctype},fields='*',ignore_permissions=True)
        #frappe.throw(frappe.as_json(mail_user))
        if mail_user:
            for i in mail_user:
                self.notify_email_all_users(i.user_email)
                
        ltc_data = frappe.get_doc("LTC Request",self.name,as_dict= True)
        if ltc_data:
            self.notify_email_all_users(ltc_data.owner)

    def notify_email_all_users(self,email_id):
        if email_id:
            parent_doc = frappe.get_doc(self.doctype,self.name)
            args = parent_doc.as_dict()
            template = 'LTC Office Memorandum'
            
            if not template:
                frappe.msgprint(frappe._("Please set default template for LTC Office Memorandum ."))
                return
            
            email_template = frappe.get_doc("Email Template",template)
            message = frappe.render_template(email_template.response_html,args)
            attachments = []
            # List of document types and names you want to attach
            documents_to_attach = [
                {"doctype": self.doctype, "name": self.name},
                {"doctype": "LTC Request", "name": self.ltc_reference_number}
            ]
            # Generate attachments for each document
            for doc in documents_to_attach:
                attachment = frappe.attach_print(doc['doctype'], doc['name'], file_name=doc['name'])
                attachments.append(attachment)
            notify(self,{
				"message":message,
				"message_to":email_id,
				"subject":email_template.subject +" "+ self.name,
				"attachments": attachments
				})
            
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
                attachments=args.attachments,
            )
            frappe.msgprint(frappe._("Email sent to {0}").format(contact))
        except frappe.OutgoingEmailError:
            pass