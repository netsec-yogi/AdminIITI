# Copyright (c) 2023, CITC IIT Indore and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from admin_iiti.approver_share import (
    notification_email,
    share_doc_with_approver,
    share_doc_with_recommender
    )
from frappe.model.document import Document

class IITForm(Document):
    def on_update(self):
        if self.status == "Open" and self.docstatus < 1:   
            if self.approvers:
                self.send_notice_and_share_doc()
        if self.status == "Recommended" and self.docstatus <1:
            self.send_notice_and_share_doc()
            
    def send_notice_and_share_doc(self):
        submit_share_doc_position = len(self.approvers) - 1
        for list in self.approvers:
            if list.status == 'Open':
                if int(self.approved_count) == submit_share_doc_position:
                    share_doc_with_approver(self,list.approver)
                    notification_email(self,list.approver,1)
                else:
                    share_doc_with_recommender(self,list.approver)
                    notification_email(self,list.approver,0)
                    return
