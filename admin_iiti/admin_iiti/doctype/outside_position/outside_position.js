// Copyright (c) 2025, CITC IIT Indore and contributors
// For license information, please see license.txt

frappe.ui.form.on('Outside Position', {
	// refresh: function(frm) {

	// }
	refresh: function(frm) {
        let logged_user = frappe.session.user;
        //frm.trigger("employee");
        // Inject CSS dynamically
        frappe.require("/assets/admin_iiti/css/outsidePosition.css");
        if(frm.doc.terms_and_conditions && !frappe.user.has_role("HR Admin")){
			frm.disable_form();
		}

        if(!frm.is_new()){
            let officer = frm.doc.reporting_officer_name;
            if(officer && frm.doc.status == 'Open'){
                frm.add_custom_button(__('Recommended'), function () {
                    let action_type = 'Forwarded By Officer';
                    change_status_outside_position(frm,action_type,logged_user);

                }).addClass("btn-primary").css({ 'color': '#ffffff', 'font-weight': 'bold', 'background-color': '#2490ef' });

                frm.add_custom_button(__('Reject'), function () {
                    let action_type = 'Rejected';
                    change_status_outside_position(frm, action_type, logged_user);
    
                }).addClass("btn-danger").css({ 'color': '#ffffff', 'font-weight': 'bold', 'background-color': 'red' })
            }
			let approver_details = get_approver_list(frm);
            const colors = ["#2490ef", "#28a745", "#6495ed", "#28a745", "#17a2b8"]; // Define color options

			if(approver_details){
				approver_details.forEach(function (list,index) {
					if(list.status == frm.doc.status && frappe.session.user === list.approver_email){
                        let button_color = colors[index % colors.length];
						frm.add_custom_button(__(list.action_status), function () {
							let action_type = list.action_status
							change_status_outside_position(frm,action_type,logged_user);
		
						}).addClass("btn-primary").css({ 'color': '#ffffff', 'font-weight': 'bold', 'background-color': button_color });
		
					}
                    // else if(list.status == 'Processed' && frappe.session.user == list.approver_email && frm.doc.status == 'Processed'){
					// 	frm.add_custom_button(__('Checked'), function () {
					// 		let action_type = 'Checked';
					// 		change_status_outside_position(frm,action_type,logged_user);
		
					// 	}).addClass("btn-primary").css({ 'color': '#ffffff', 'font-weight': 'bold', 'background-color': '#2490ef' });
		
		
					// }else if( list.status == 'Checked' && frappe.session.user == list.approver_email && frm.doc.status == 'Checked'){
					// 	frm.add_custom_button(__('Recommend'), function () {
					// 		let action_type = 'Recommended';
					// 		change_status_outside_position(frm, action_type,logged_user);
					// 	}).addClass("btn-primary").css({ 'color': '#ffffff', 'font-weight': 'bold', 'background-color': '#6495ed' });
					// }else if (list.status == 'Recommended' && frappe.session.user == list.approver_email && frm.doc.status == 'Recommended'){

					// 	frm.add_custom_button(__('Approve'), function () {
					// 		let action_type = 'Approved';
					// 		change_status_outside_position(frm, action_type,logged_user);
					// 	}).addClass("btn-primary").css({ 'color': '#ffffff', 'font-weight': 'bold', 'background-color': '#28a745' });
					// }
	
				});
			}
			
		}
    },

    onload:function(frm){
        //frm.trigger("employee");
        if(frm.doc.terms_and_conditions && !frappe.user.has_role("HR Admin")){
			frm.disable_form();
		}
    },

	employee: function(frm) {
        if (frm.doc.employee) {
            // 🔹 Step 1: Reset all fields before fetching new data
            let fields = ['employee_name', 'designation', 'department', 'date_of_joining', 'user_id','pnt_number'];

            fields.forEach(field => {
                frm.set_value(field, null);
                frm.set_df_property(field, 'read_only', 0);
                frm.set_df_property(field, 'hidden', 0);
            });

            // 🔹 Step 2: Fetch New Employee Data
            frappe.call({
                method: "frappe.client.get",
                args: {
                    doctype: "Employee",
                    name: frm.doc.employee,
                },
                callback: function(r) {
                    if (r.message) {
                        fields.forEach(field => {
                            if (r.message[field]) {
                                // Autofill & Make Read-Only
                                frm.set_value(field, r.message[field]);
                                frm.set_df_property(field, 'read_only', 1);
                            } else {
                                // Keep Editable if No Data
                                frm.set_df_property(field, 'read_only', 0);
                            }
                        });

						frm.set_df_property('user_id', 'hidden', 1);
                    }
                }
            });
        } else {
            // 🔹 If no employee is selected, clear all fields
            fields.forEach(field => frm.set_value(field, null));
        }
    },

	reporting_officer_name: function (frm) {
        if (frm.doc.reporting_officer_name) {
            let data = employee_data(frm.doc.reporting_officer_name);
            if(data){
                frm.set_value('reporting_officer_designation', data.designation || '');
                frm.set_value('reporting_officer_department', data.department || '');
                frm.set_value('reporting_officer_contact', data.cell_number || '');
            }
        }
    },

    terms_and_conditions:function(frm){
		if(frm.doc.terms_and_conditions){
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
					frm.set_value("terms_and_conditions",'');
					frm.set_value('status','');
				}

			)
		}else{
			frm.set_value("terms_and_conditions",'');
		}
		
	},
});

function employee_data(user) {
	let details = []
	frappe.call({
		"method": 'admin_iiti.overrides.get_employee_data',
		"args": {
			"user_id": user,
		},
		"async": false,
		callback: function (r) {
			let  data = r.message;
			if (r && r.message) {
				details = data;
			}
		}
	});
	return details;
}
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

function change_status_outside_position(frm,action_type,user){
	frappe.call({
		method: "admin_iiti.admin_iiti.doctype.outside_position.outside_position.update_outside_position_status",
		async: true,
		args: {
			doctype :frm.doc.doctype,
			document_name: frm.doc.name,
			status: action_type,
			user: user,
		},
		callback: function (r) {
			let data = r.message;
            console.log("data",data);
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
    if (status != 'Approved'){
        let comments = 'Recommended By ' + user +' ('+ datetime + ')';
    }else{
        let comments = 'Approved By ' + user +' ('+ datetime + ')';
    }
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