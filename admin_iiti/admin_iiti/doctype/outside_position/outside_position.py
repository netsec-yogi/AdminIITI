# Copyright (c) 2025, CITC IIT Indore and contributors
# For license information, please see license.txt
import json
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
import frappe
from frappe.model.document import Document
from frappe.model.naming import getseries

class OutsidePosition(Document):
    def validate(self):
        if self.is_new():
            self.approval_email()
    def autoname(self):
        current_year = getdate(today()).year
        prefix = f"IIT-Admin-OPR-{current_year}"
        x = getseries(prefix,3)
        
        if self.pnt_number:
            self.name = f"IITI/Admin/PNT-{self.pnt_number}/{current_year}/{x}"
        else:
            self.name = f"IITI/Admin/PNT-{x}/{current_year}/{x}"
            
    def on_update(self):
        #frappe.throw(frappe.as_json(self))
        if self.terms_and_conditions:
            if self.reporting_officer and self.status == 'Open':
                self.share_with_reporting_officer()
                
            if self.status == 'Forwarded By Reporting Officer' and self.reviewing_officer_name:
                self.share_doc_user_withwrite(self.reviewing_officer_name)
                self.notify_document(self.reviewing_officer_name,1)
                                
            if self.reviewing_officer_name and not self.reporting_officer and (self.status == 'Forwarded By Reporting Officer' or self.status == 'Open'):
                self.share_doc_user_withwrite(self.reviewing_officer_name)
                self.notify_document(self.reviewing_officer_name,1)
                
            if self.status == 'Forwarded By Officer':
                self.administrative_approver_share()
        self.reload()
        
    def on_submit(self):
        if self.status == 'Approved':
            #self.share_doc_user(self.user_id)
            self.update_employee_profile()
            
    def administrative_approver_share(self):
        approval_data = frappe.get_doc("Note Sheet Approval Process",self.doctype,as_dict = 1)
        if approval_data and approval_data.approval_stage:
            for ad in approval_data.approval_stage:
                if ad.status == self.status:
                    self.share_doc_user(ad.approver_email)
                    self.notify_document(ad.approver_email,1)
                    
    def share_with_reporting_officer(self):
        for r in self.reporting_officer:
            if r.status == 'Open':
                self.notify_document(r.recommender,1)
                self.share_doc_user_withwrite(r.recommender)
        
    def share_doc_user_withwrite(doc, user):
        if not frappe.has_permission(doc=doc, ptype="write", user=user):
            frappe.share.add_docshare(doc.doctype, doc.name, user, write=1, flags={"ignore_share_permission": True})
            frappe.msgprint(
                frappe._("Shared with the user {0} with {1} access").format(user, frappe.bold("save"), alert=True))
            
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
                template = 'Outside Position Notification'
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
                "subject": email_template.subject + " " +self.employee_name +"," + self.designation + " - regarding",
            })
    
    def approval_email(self):
        if self.reviewing_officer_name:
            if self.reviewing_officer_name == frappe.session.user:
                frappe.throw(frappe._("You cannot select yourself as reviewing Officer."))
                
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
    
    def update_employee_profile(self):
        if self.employee:
            child = frappe.new_doc("Outside Position Previous Applications")  # Replace with the actual child table Doctype name
            child.parent = self.employee
            child.parenttype = "Employee"
            child.parentfield = "application_for_noc"  # Confirm fieldname in the Employee Doctype
            child.position_applied_for = self.position_applying_for
            child.location_applied_to = self.location_of_the_position
            child.yearmonth = getdate(self.application_submission_date).strftime("%Y-%m")
            child.insert(ignore_permissions=True)
            
            frappe.db.commit()
            
@frappe.whitelist()
def update_reporting_officer_status(doctype, document_name, status, user):
    current_date_time = frappe.utils.now_datetime()
    doc = frappe.get_doc(doctype, document_name)

    if status == 'Forwarded By Reporting Officer':
        updated = False
        for row in doc.reporting_officer:
            if row.recommender == user:
                row.status = 'Recommended'
                row.docstatus = 1
                row.recommend_date_time = current_date_time
                updated = True
                break

        if updated:
            doc.save(ignore_permissions=True)

            # Check if all recommenders have recommended
            recommended_count = sum(1 for row in doc.reporting_officer if row.status == 'Recommended')
            total_recommender_count = len(doc.reporting_officer)

            if recommended_count == total_recommender_count:
                doc.status = 'Forwarded By Reporting Officer'
                doc.save(ignore_permissions=True)
                return 'Forwarded By Reporting Officer'

    return 'Open'

@frappe.whitelist()
def update_forwared_user_status(doctype, document_name, status, user,forwared_user):
    if forwared_user:
        current_date_time = frappe.utils.now_datetime()
        doc = frappe.get_doc(doctype,document_name)
        self = doc
        frappe.db.set_value(doctype, {'name': document_name},{'status': status},update_modified=False)
        employee = frappe.get_doc("Employee", {'user_id':user},as_dict = 1,ignore_permission = True)
        if employee:
            salutation = employee.salutation or ""
            emp_name = employee.employee_name or ""
            designation = employee.designation or "N/A"
            department = employee.department or "N/A"
        else:
            # Fallbacks if employee not found
            salutation = ""
            emp_name = get_fullname(user)  # fallback to user's full name
            designation = "Not Available"
            department = "Not Available"
            
        approver = {
            "comment": "Forwared By " + get_fullname(frappe.session.user),
            "approve_name": salutation + "." + emp_name if salutation else emp_name,
            "designation":designation,
            "department":department,
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
        self.share_doc_user(forwared_user)
        self.notify_document(forwared_user,1)
        
        doc.save(ignore_permissions=True)
        frappe.db.commit()
        
        return status
    
        
@frappe.whitelist()
def update_outside_position_status(doctype, document_name, status, user):
    if user:
        current_date_time = frappe.utils.now_datetime()
        doc = frappe.get_doc(doctype,document_name)
        self = doc
        frappe.db.set_value(doctype, {'name': document_name},{'status': status},update_modified=False)
        employee = frappe.get_doc("Employee", {'user_id':user},as_dict = 1,ignore_permission = True)
        if employee:
            salutation = employee.salutation or ""
            emp_name = employee.employee_name or ""
            designation = employee.designation or "N/A"
            department = employee.department or "N/A"
        else:
            # Fallbacks if employee not found
            salutation = ""
            emp_name = get_fullname(user)  # fallback to user's full name
            designation = "Not Available"
            department = "Not Available"
        
        if status != 'Approved':
            approver = {
                "comment": "Recommend By " + get_fullname(frappe.session.user),
                "approve_name": salutation + "." + emp_name if salutation else emp_name,
                "designation":designation,
                "department":department,
                "status":status,
                "email": user,
                "datetime": str(current_date_time)  # Ensure datetime is in string format
            }
        else:
            approver = {
                "comment": "Approved By " + get_fullname(frappe.session.user),
                "approve_name":employee.salutation +"." + employee.employee_name,
                "designation":employee.designation,
                "department":employee.department,
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
            self.administrative_approver_share()
            doc.save(ignore_permissions=True)
            self.reload()
        else:
            doc.submit()
        
        return status
    
@frappe.whitelist()
def update_reject_status(doctype, document_name, status, user):
    if status == 'Rejected':
        current_date_time = frappe.utils.now_datetime()
        doc = frappe.get_doc(doctype,document_name)
        self = doc
        #frappe.db.set_value(doctype, {'name': document_name},{'status': status},update_modified=False)
        employee = frappe.get_doc("Employee", {'user_id':user},as_dict = 1,ignore_permission = True)
        
        if employee:
            salutation = employee.salutation or ""
            emp_name = employee.employee_name or ""
            designation = employee.designation or "N/A"
            department = employee.department or "N/A"
        else:
            # Fallbacks if employee not found
            salutation = ""
            emp_name = get_fullname(user)  # fallback to user's full name
            designation = "Not Available"
            department = "Not Available"
            
        approver = {
            "comment": "Rejected By " + get_fullname(frappe.session.user),
            "approve_name": salutation + "." + emp_name if salutation else emp_name,
            "designation":designation,
            "department":department,
            "status":status,
            "email": user,
            "datetime": str(current_date_time)  # Ensure datetime is in string format
        }
        
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
        #frappe.throw(frappe.as_json(self))
        doc.save()
        
        return status
    
@frappe.whitelist()
def cancel_noc_document(docname, doctype, reason):
	doc = frappe.get_doc(doctype, docname)

	# Allow cancellation even if not submitted
	if hasattr(doc, "status"):
		doc.status = "Cancelled"

	# Save changes
	doc.save(ignore_permissions=True)
	frappe.db.commit()
	return {"status": "cancelled"}