# Copyright (c) 2023, CITC IIT Indore and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document

class TestDoc(Document):
    def on_update(self):
        self.notify_email_all_users("princy@iiti.ac.in")
        
    def notify_email_all_users(self,email):
        attachments = []
        attachment = frappe.attach_print('LTC Request', 'IIT-Admin-PNT-2024-00025', file_name='IIT-Admin-PNT-2024-00025')
        attachments.append(attachment)
        notesheet_name = 'Test Print'
        # List of document types and names you want to attach
        if notesheet_name == 'Test Print':
            attachment = frappe.attach_print(self.doctype, self.name, file_name=self.name,print_format='Test Print')
            attachments.append(attachment)
            
        try:
            frappe.sendmail(
                recipients=email,
                subject="Test Email",
                message="This is a test email",
                attachments=attachments,
            )
            frappe.msgprint(frappe._("Email sent to {0}").format(email))
        except frappe.OutgoingEmailError:
            pass
