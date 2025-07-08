// Copyright (c) 2025, CITC IIT Indore and contributors
// For license information, please see license.txt

frappe.ui.form.on('Outside Position', {
	// refresh: function(frm) {

	// }
	refresh: function(frm) {
        let logged_user = frappe.session.user;
        //frm.trigger("employee");
        // Inject CSS dynamically
		if(frappe.session.user == 'Administrator' || frappe.user.has_role("HR Admin")){
			frm.set_df_property('outside_position_previous_applications', 'read_only', 0);
		}else{
			frm.set_df_property('outside_position_previous_applications', 'read_only', 1);

		}
        frappe.require("/assets/admin_iiti/css/outsidePosition.css");
        if(frm.doc.terms_and_conditions && !frappe.user.has_role("HR Admin")){
			frm.disable_form();
		}

        if(!frm.is_new()){
			let reporting_officer = frm.doc.reporting_officer;
            let reviewing_officer  = frm.doc.reviewing_officer_name;
			if(reporting_officer){
				reporting_officer.forEach(function (list,index) {

					if(list.recommender != reviewing_officer){
						frm.add_custom_button(__('Recommend'), function () {
							let action_type = 'Forwarded By Reporting Officer';
							change_status_reporting_officer(frm,action_type,logged_user);

						}).addClass("btn-primary").css({ 'color': '#ffffff', 'font-weight': 'bold', 'background-color': '#2490ef' });
					}
				});
			}
            if(reviewing_officer == frappe.session.user && frm.doc.status == 'Open'){
                frm.add_custom_button(__('Recommend'), function () {
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
						frm.add_custom_button(__(list.status_label_name), function () {
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
		let user_list = [frappe.session.user];
		frm.fields_dict.reviewing_officer_name.get_query = function(doc) {
            return {
                filters:{
					name: ['not in', user_list],
					Enabled:1,
				} 
            };
        };
    },

	employee: function(frm) {
        if (frm.doc.employee) {
            // 🔹 Step 1: Reset all fields before fetching new data
            let fields = ['employee_name', 'designation', 'department', 'date_of_joining', 'user_id','pnt_number','pay_level'];

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
						console.log("mess",r.message);
						let data = r.message;
						// Set and merge salutation + employee_name
						let salutation = r.message.salutation || '';
						let emp_name = r.message.employee_name || '';
	
						if (salutation && emp_name) {
							frm.set_value('employee_name', `${salutation}. ${emp_name}`);
						} else {
							frm.set_value('employee_name', emp_name);
						}
                        fields.forEach(field => {
							if (field === 'employee_name') return; // Already handled
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
						if(data.application_for_noc.length>0){
							cur_frm.clear_table('outside_position_previous_applications');
							$.each(data.application_for_noc, function (i, d) {
								var val = frm.add_child('outside_position_previous_applications');
								val.location_applied_to = d.location_applied_to,
								val.position_applied_for = d.position_applied_for,
								val.yearmonth = d.yearmonth
							});
							refresh_field('outside_position_previous_applications');
						}else{
							cur_frm.clear_table('outside_position_previous_applications');
							refresh_field('outside_position_previous_applications');
						}
                    }
                }
            });
        } else {
            // 🔹 If no employee is selected, clear all fields
            fields.forEach(field => frm.set_value(field, null));
        }
    },

	reviewing_officer_name: function (frm) {
        if (frm.doc.reviewing_officer_name) {
            let data = employee_data(frm.doc.reviewing_officer_name);
            if(data){
                frm.set_value('reviewing_officer_designation', data.designation || '');
                frm.set_value('reviewing_officer_department', data.department || '');
                frm.set_value('reviewing_officer_contact', data.cell_number || '');
				frm.set_df_property('reviewing_officer_designation', 'read_only', 1);
				frm.set_df_property('reviewing_officer_department', 'read_only', 1);
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

frappe.ui.form.on('Leave Recommender', 'recommender', function (frm, cdt, cdn) {
	var val = locals[cdt][cdn];
	if(val.recommender == frappe.session.user){
		frappe.msgprint("invalid Recommender selected");
		val.recommender = ""
		cur_frm.clear_table('reviewing_officer');
	}
	let data = employee_data(val.recommender);
	val.department = data.department;
	val.designation = data.designation;	
	frm.refresh_field("reviewing_officer");

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
			if(data){
				cur_frm.set_value('status',data);
				//cur_frm.save();
				//window.reload();
				frm.reload_doc();
				recommender_comment_post(frm,action_type,user);
				//frm.refresh();
			}
			
		
		}
	});
}

function recommender_comment_post(frm,status,user) {
	let datetime = frappe.datetime.now_datetime();
	let  comments = '';
    if (status != 'Approved'){
        comments = 'Recommended By ' + user +' ('+ datetime + ')';
    }else{
        comments = 'Approved By ' + user +' ('+ datetime + ')';
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