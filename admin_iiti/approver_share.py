import frappe
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

@frappe.whitelist()
def get_employee_data(user_id):
    data = frappe.db.get_value('Employee', {'user_id':user_id}, ['department', 'designation','employee_id','employee_name','salutation','employee_name'],as_dict =1)
    return data

@frappe.whitelist()
def change_status(document_name,status,user,approved_count,total_approver_count,doctype_name):
    current_date_time = frappe.utils.now_datetime()
    child_doc = 'Approvers'
    if status == 'Recommended':        
        approver = frappe.get_doc(child_doc,{'parent':document_name,'approver':user})
        approver.docstatus = 1
        approver.status = 'Recommended'
        approver.status_change_date_time = current_date_time
        approver.update_modified = False
        approver.save(ignore_permissions=True)
        
        docstatus = 'Open'
        
        Recommended_data = frappe.db.count(child_doc,{'parent':document_name,'status':'Recommended'})
        total_recommender_one_minus = int(total_approver_count) - 1
        
        if total_recommender_one_minus == int(approved_count):
            docstatus = 'Recommend'
            
    elif status == 'Approved':
        approver = frappe.get_doc(child_doc,{'parent':document_name,'approver':user})
        approver.status = 'Approved'
        approver.status_change_date_time = current_date_time
        approver.update_modified = False
        approver.save(ignore_permissions=True)
        approver.reload()
        
        docstatus = 'Approved'
        
    elif status == 'Rejected':
        approver = frappe.get_doc(child_doc,{'parent':document_name,'approver':user})
        approver.docstatus = 1
        approver.status = 'Rejected'
        approver.status_change_date_time = current_date_time
        approver.update_modified = False
        approver.save(ignore_permissions=True)
        approver.reload()
        
        docstatus = 'Rejected'

    return docstatus
    

@frappe.whitelist()
def share_doc_with_recommender(doc, user):
    if not frappe.has_permission(doc=doc, ptype="write", user=user):
        frappe.share.add_docshare(doc.doctype, doc.name, user, write=1, flags={"ignore_share_permission": True})
        frappe.msgprint(
            frappe._("Shared with the user {0} with {1} access").format(user, frappe.bold("save"), alert=True))

@frappe.whitelist()
def share_doc_with_approver(doc, user):
    if not frappe.has_permission(doc=doc, ptype="submit", user=user):
        frappe.share.add_docshare(doc.doctype, doc.name, user, submit=1, flags={"ignore_share_permission": True})
        frappe.msgprint(
            frappe._("Shared with the user {0} with {1} access").format(user, frappe.bold("submit"), alert=True))

@frappe.whitelist()
def notification_email(self,email_id,flags):
    if email_id:
        parent_doc = frappe.get_doc(self.doctype,self.name)
        args = parent_doc.as_dict()
        
        if self.doctype == 'Departmental Forms' and flags == 0:
            template = 'Departmental Forms'
        elif self.doctype == 'Departmental Forms' and flags == 1:
            template = 'Forms Approved Notification'
        elif self.doctype == 'IIT Form' and flags == 0:
            template = 'IITI Form'
        elif self.doctype == 'IIT Form' and flags == 1:
            template = 'Forms Approved Notification'
        else:
            template = ''
        
        if not template:
            frappe.msgprint(frappe._("Please set default template ."))
            return
        
        email_template = frappe.get_doc("Email Template",template)
        message = frappe.render_template(email_template.response_html,args)
        notify(self,{
            "message":message,
            "message_to":email_id,
            "subject":email_template.subject
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
            )
            frappe.msgprint(frappe._("Email sent to {0}").format(contact))
        except frappe.OutgoingEmailError:
            pass