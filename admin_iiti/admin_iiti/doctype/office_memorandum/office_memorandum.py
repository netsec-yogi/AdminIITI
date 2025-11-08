# Copyright (c) 2025, CITC IIT Indore and contributors
# For license information, please see license.txt
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
import frappe
from frappe.model.document import Document

class OfficeMemorandum(Document):
    def on_update(self):
        mail_user = frappe.db.get_list("Note Sheets Email", filters={'status':'Active','document_name':self.notesheet_name},fields='*',ignore_permissions=True)
        if mail_user:
            for i in mail_user:
                self.notify_email_all_users(i.user_email)
                
        data = frappe.get_doc(self.notesheet_name,self.document_name,as_dict= True)
        if data:
            user_email = frappe.get_doc("Employee", data.employee).user_id
            if user_email:
                self.notify_email_all_users(user_email)
            
    def notify_email_all_users(self,email_id):
        if email_id:
            parent_doc = frappe.get_doc(self.notesheet_name,self.document_name)
            args = parent_doc.as_dict()
            if self.notesheet_name == 'Transport Allowance':
                template = 'Office Memorandum for transport allowance'
            else:
                template = ''
            
            if not template:
                frappe.msgprint(frappe._("Please set default template for Office Memorandum."))
                return
            
            email_template = frappe.get_doc("Email Template",template)
            message = frappe.render_template(email_template.response_html,args)  
                
            attachments = []
        
            if self.notesheet_name == 'Transport Allowance':
                subject = f"{email_template.subject} {args.get('employee_name', '')}, {args.get('designation', '')} - regarding"
                attachment_one = frappe.attach_print(self.notesheet_name, self.document_name, file_name=self.document_name,print_format='Custom Transport Allowance')
                attachments.append(attachment_one)
                attachment_two = frappe.attach_print(self.doctype, self.name, file_name=self.name,print_format='Transport Allowance OM')
                attachments.append(attachment_two)
            else:
                subject = f"{email_template.subject} {self.notesheet_name}"
                
            notify(self,{
				"message":message,
				"message_to":email_id,
				"subject":subject,
                "attachments":attachments
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
            
     
