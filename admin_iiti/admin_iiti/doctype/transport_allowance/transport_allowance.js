// Copyright (c) 2025, CITC IIT Indore and contributors
// For license information, please see license.txt

frappe.ui.form.on('Transport Allowance', {
	refresh: function(frm) {
		let logged_user = frappe.session.user;
		if(frm.doc.i_confirm && frappe.session.user != 'Administrator'){
			frm.disable_form();
			//frm.fields_dict['your_fieldname'].$wrapper.find('input').addClass('custom-css-class');
		}

		if(!frm.is_new()){
			let approver_details = get_approver_list(frm);
			if(approver_details){
				approver_details.forEach(function (list) {
					console.log("list.approver_email",list.approver_email);
					if(list.status == 'Open' && frappe.session.user === list.approver_email && frm.doc.status == 'Open'){
						frm.add_custom_button(__('Proceed'), function () {
							let action_type = 'Processed';
							change_status_note_sheet(frm,action_type,logged_user);
		
						}).addClass("btn-primary").css({ 'color': '#ffffff', 'font-weight': 'bold', 'background-color': '#2490ef' });
		
		
					}else if(list.status == 'Processed' && frappe.session.user == list.approver_email && frm.doc.status == 'Processed'){
						frm.add_custom_button(__('Checked'), function () {
							let action_type = 'Checked';
							change_status_note_sheet(frm,action_type,logged_user);
		
						}).addClass("btn-primary").css({ 'color': '#ffffff', 'font-weight': 'bold', 'background-color': '#2490ef' });
		
		
					}else if( list.status == 'Checked' && frappe.session.user == list.approver_email && frm.doc.status == 'Checked'){
						frm.add_custom_button(__('Recommend'), function () {
							let action_type = 'Recommended';
							change_status_note_sheet(frm, action_type,logged_user);
						}).addClass("btn-primary").css({ 'color': '#ffffff', 'font-weight': 'bold', 'background-color': '#6495ed' });
					}else if (list.status == 'Recommended' && frappe.session.user == list.approver_email && frm.doc.status == 'Recommended'){

						frm.add_custom_button(__('Approve'), function () {
							let action_type = 'Approved';
							change_status_note_sheet(frm, action_type,logged_user);
						}).addClass("btn-primary").css({ 'color': '#ffffff', 'font-weight': 'bold', 'background-color': '#28a745' });
					}
	
				});
			}
			
		}

		frm.set_query("employee", function() {  
            return {
                filters: {
                    employee_category: "Non-Teaching"  // Show only Non-Teaching employees
                }
            };
        });
	},
	onload:function(frm){	
		let logged_user = frappe.session.user;
		if(frm.doc.i_confirm && frappe.session.user != 'Administrator'){
			frm.disable_form();
		}
	},
	i_confirm:function(frm){
		if(frm.doc.i_confirm){
			frappe.confirm(
				('Click yes, if you have checked all the details of the note sheet.Once submitted you will not be allowed to edit the form futher.'),
				function(){
					if(frm.doc.status == 'Returned for change'){
						frm.set_value('status','Draft')
					}
					frm.set_value('status','Open');
					cur_frm.save();
				},
				function(){
					//show_alert('Thanks for continue here!')
					show_alert('Close the tab');
					frm.set_value("i_confirm",'');
					frm.set_value('status','');
				}

			)
		}else{
			frm.set_value("i_confirm",'');
		}
		
	},

	employee: function(frm) {
        console.log("Employee selected:", frm.doc.employee);
        if (frm.doc.employee) {
            frappe.model.get_value('Employee', frm.doc.employee, 
                ['employee_name', 'department', 'pay_level', 'designation', 'pnt_number','salutation'], (r) => {
                console.log("Fetched Employee Data:", r);
                if (r) {
                    frm.set_value('employee_name',r.salutation+'. '+r.employee_name);
                    frm.set_value('department', r.department);
                    frm.set_value('pay_level', r.pay_level);
                    frm.set_value('designation', r.designation);
                    frm.set_value('pnt_no', r.pnt_number);

                    // Set fields read-only if values exist
                    frm.set_df_property('department', 'read_only', r.department ? 1 : 0);
                    frm.set_df_property('pay_level', 'read_only', r.pay_level ? 1 : 0);
                    frm.set_df_property('designation', 'read_only', r.designation ? 1 : 0);
                    frm.set_df_property('pnt_no', 'read_only', r.pnt_number ? 1 : 0);
                }
            });

            // 🔹 Filter Leave Application dropdown to show only the selected employee's records
            frm.set_query("leave_application", function() {
				console.log("employee",frm.doc.employee)
                return {
                    filters: {
                        employee: frm.doc.employee, // Show only leave applications of the selected employee
						status: "Approved"  
                    }
                };
            });
        }
    },

    leave_application: function(frm) {
        console.log("Selected Leave Application:", frm.doc.leave_application);
        if (frm.doc.leave_application) {
            frappe.model.get_value('Leave Application', frm.doc.leave_application, ['from_date', 'to_date'], (r) => {
                if (r) {
                    frm.set_value('leave_from_date', r.from_date);
                    frm.set_value('leave_to_date', r.to_date);

                    // Make fields read-only if they have values
                    frm.set_df_property('leave_from_date', 'read_only', r.from_date ? 1 : 0);
                    frm.set_df_property('leave_to_date', 'read_only', r.to_date ? 1 : 0);
                }
            });
        }
    }
});
function get_approver_list (frm){
	let data = []

	frappe.call({
		method: "frappe.client.get_list",
		args: {
			doctype: "Approval Stage",  // Child Table Doctype
			filters: { parent: frm.doc.doctype },  // Parent field in child table
			fields: ["*"],
			parent: 'Note Sheet Approval Process',
		},
		async: false,
		callback: function(r){
	        data=r.message;
		} 
	});
	return data;
}
function change_status_note_sheet(frm,action_type,user){
	frappe.call({
		method: "admin_iiti.admin_iiti.doctype.transport_allowance.transport_allowance.update_notesheet_status",
		async: true,
		args: {
			doctype :frm.doc.doctype,
			document_name: frm.doc.name,
			status: action_type,
			user: user,
		},
		callback: function (r) {
			let data = r.message;
			if(data){
				cur_frm.set_value('status',data);
				cur_frm.save();
				//window.reload();
				recommender_comment_post(frm,action_type,user);
				frm.reload_doc();
				frm.refresh();
			}
			
		
		}
	});
}

function recommender_comment_post(frm,status,user) {
	let datetime = frappe.datetime.now_datetime();
	let comments = 'Recommended By ' + user +' ('+ datetime + ')';
	frappe.call({
		method: "frappe.desk.form.utils.add_comment",
		args: {
			reference_doctype: frm.doc.doctype,
			reference_name: frm.doc.name,
			content: __(comments),
			comment_email: user,
			comment_by: frappe.session.user_fullname
		},
		callback: function(r) {
			if(!r.exc) {
			}
		}
	});
}
