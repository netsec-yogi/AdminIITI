import frappe
from frappe.model.document import Document
from frappe.utils.background_jobs import enqueue


class BulkMailingSystem(Document):
        def on_submit(self):
                bulk_send_mail(self)


@frappe.whitelist()
def bulk_send_mail(self):
        mailing_list_doc = frappe.get_doc("Bulk Email List", self.mailing_list).as_dict()

        if mailing_list_doc:
                for ml_item in mailing_list_doc.email_id_list:
                        email_args = {
                        "recipients": [ml_item.email_address],
                        "message": self.mail_content,
                        "subject": self.subject,
                        }
                        enqueue(method=frappe.sendmail, queue="short", timeout=300, is_async=True, **email_args)

       
             
      
