// Copyright (c) 2022, CITC IIT Indore and contributors
// For license information, please see license.txt
cur_frm.add_fetch('employee', 'employee_name', 'employee_name');
frappe.ui.form.on('LTC Request', {
	
	refresh: function(frm) {
		let logged_user = frappe.session.user;
		if (frm.is_new()) {
			frm.trigger("calculate_total_days");
			frm.set_value('status','Open');
		}else{
			if(frappe.user.has_role('HR Dealing Assistant') && frm.doc.status == 'Open' || !frm.doc.owner == frappe.session.user ){
				frm.add_custom_button(__('Proceed'), function () {
					let action_type = 'Processed';
					change_status_LTC(frm,action_type,logged_user);

				}).addClass("btn-primary").css({ 'color': '#ffffff', 'font-weight': 'bold', 'background-color': '#2490ef' });


			}else if(frappe.user.has_role('HR User') && frm.doc.status == 'Processed' && !frappe.user.has_role('HR Dealing Assistant') || !frm.doc.owner == frappe.session.user){
				frm.add_custom_button(__('Checked'), function () {
					let action_type = 'Checked';
					change_status_LTC(frm,action_type,logged_user);

				}).addClass("btn-primary").css({ 'color': '#ffffff', 'font-weight': 'bold', 'background-color': '#2490ef' });


			}else if(frappe.user.has_role('HR Manager') && frm.doc.status == 'Checked' || !frm.doc.owner == frappe.session.user){
				frm.add_custom_button(__('Recommend'), function () {
					let action_type = 'Recommended';
					change_status_LTC(frm, action_type,logged_user);
				}).addClass("btn-primary").css({ 'color': '#ffffff', 'font-weight': 'bold', 'background-color': '#6495ed' });
			}

			if(frappe.session.user == frm.doc.approver && frm.doc.status == 'Recommended'){
				frm.add_custom_button(__('Sanction'), function () {
					let action_type = 'Sanction';
					let user_details = frappe.session.user;
					change_status_LTC(frm,action_type,user_details);
				}).addClass("btn-primary").css({ 'color': '#ffffff', 'font-weight': 'bold', 'background-color': '#6495ed' });

				// frm.add_custom_button(__('Reject'), function () {
				// 	let action_type = 'Rejected';
				// 	change_status_LTC(frm,action_type, frm.doc.approver);
				// }).addClass("btn-danger").css({ 'color': '#ffffff', 'font-weight': 'bold', 'background-color': 'red' })

				frm.add_custom_button(__('Reject'), 
					() => reject_with_resone(frm)).addClass("btn-danger")
					.css({ 'color': '#ffffff', 'font-weight': 'bold', 'background-color': 'red' });
			}

			// if(frappe.session.user == frm.doc.owner){
			// 	frm.disable_form();
			// }
			if(frappe.user.has_role('HR Manager') || frm.doc.approver == logged_user){
				if(frappe.session.user != 'hrmanager@iiti.ac.in'){
					frm.disable_form();
				}	
			}
			if(frappe.user.has_role('HR User') || frappe.user.has_role('HR Dealing Assistant')){
				//frm.disable_form();
				if(frappe.session.user != 'hrmanager@iiti.ac.in'){
					frm.disable_save();
				}
			}
			if(frm.doc.status == 'Open'){
				frm.trigger('document_cancel');
			}

			if(frappe.session.user == 'hrmanager@iiti.ac.in' && frm.doc.status != 'Approve'){
				frm.trigger('document_cancel');
			}
		}
		cur_frm.set_intro("");
		if (frm.doc.__islocal && !in_list(frappe.user_roles, "Employee")) {
			frm.set_intro(__("Fill the form and save it"));
		}

		if (!frm.doc.employee && frappe.defaults.get_user_permissions()) {
			const perm = frappe.defaults.get_user_permissions();
			if (perm && perm['Employee']) {
				frm.set_value('employee', perm['Employee'].map(perm_doc => perm_doc.doc)[0]);
			}
		}
	},

	onload: function(frm) {

		if (!frm.is_new()) {
			if(frappe.session.user == frm.doc.owner){
				frm.toggle_display("admin_section_tab", false);
				frm.toggle_display("amount_advance",false);
				frm.toggle_display("calculation_basic_pay",false);
				frm.toggle_display("calculation_of_encashment_of_el",false);
			}else{
				frm.toggle_display("admin_section_tab", true);
				frm.toggle_display("amount_advance",true);
				frm.toggle_display("calculation_basic_pay",true);
				frm.toggle_display("calculation_of_encashment_of_el",true);
			}
			
			
			//frm.toggle_display("status",true);

			if((frappe.session.user == frm.doc.owner) && !(frm.doc.status == 'Open')){
				frm.disable_form();
				
				
			}
			if(frappe.user.has_role('HR Manager')){
				if(frappe.session.user != 'hrmanager@iiti.ac.in'){
					frm.disable_form();
				}
					
			}
			if(frappe.user.has_role('HR User')){
				//frm.disable_form();
				if(frappe.session.user != 'hrmanager@iiti.ac.in'){
					frm.disable_save();
				}
			}
			if(frm.doc.status == 'Open'){
				frm.trigger('document_cancel');
			}

			if(frappe.session.user == 'hrmanager@iiti.ac.in' && frm.doc.status != 'Approve'){
				frm.trigger('document_cancel');
			}

			
		}else{
			frm.set_df_property('status', 'options', ['Open'])
			if (frm.doc.docstatus == 0 && frm.doc.employee) {
				frm.trigger("employee_dependent_get");
				frm.trigger("one_year_service");
			}
		}
		cur_frm.fields_dict.leave_application.get_query = function(doc) {
			return {
				filters: {
					status: 'Approved',
					employee : doc.employee
				},
				order_by: 'posting_date desc',
			}
		}
	},

	employee: function(frm) {
		frm.trigger("employee_dependent_get");
		frm.trigger("one_year_service");
	},
	is_dependence:function(frm){
		if(frm.doc.is_dependence){
			frm.toggle_display("leave_application", false);
		}else{
			frm.toggle_display("leave_application", true);
		}
	},

	leave_application:function(frm){

		if(frm.doc.leave_application){

			frm.trigger("get_leave_application");
		}

		if(frm.doc.employee && frm.doc.leave_type_name){

			set_approver(frm);

		}

	},
	get_leave_application:function(frm){
		frappe.call({
			"method": "frappe.client.get_value",
			"args": {
				doctype: "LTC Request",
				filters: [
					["leave_application", "=", frm.doc.leave_application]
				],
				fieldname: ["name","docstatus"]
			},
			"callback": function (response) {
				var data = response.message;

				if (data.name && data.docstatus != 2) {

					frappe.msgprint(__("You already Applied LTC Request for this Leave Application"));
					frm.set_value("leave_application", "")

				}
			}
		});
	},
	one_year_service:function(frm){
		frappe.call({
			"method": "frappe.client.get_value",
			"args": {
				doctype: "Employee",
				filters: [
					["name", "=", frm.doc.employee]
				],
				fieldname: "date_of_joining"
			},
			"callback": function (response) {
				var data = response.message;

				var one_year_date = frappe.datetime.add_days(data.date_of_joining, 365)

				var current_date = frappe.datetime.nowdate();

				if (one_year_date > current_date) {

					frappe.msgprint(__("After One Year Services Than you Can Applied LTC."));
					frm.set_value("employee", "")

				}
			}
		});
	},
	employee_dependent_get:function(frm){
		frappe.call({
			"method": "frappe.client.get_list",
			"args": {
				doctype: "Employee Dependent Details",
				filters: [
					["parent", "=", frm.doc.employee]
				],
				parent: 'Employee',
				fields:['dependent_name','date_of_birth','relation']
			},
			
			"callback": function (response) {
				
				var depended = response.message;
				//console.log(depended);
				if(depended.length >0){
					cur_frm.clear_table('ltc_claimed');
	
					depended.forEach(function (item) {
						var age = get_age(item.date_of_birth);
		
						var child = cur_frm.add_child('ltc_claimed');
						frappe.model.set_value(child.doctype, child.name, 'family_members', item.dependent_name);
						frappe.model.set_value(child.doctype, child.name, 'age', age);
						frappe.model.set_value(child.doctype, child.name, 'relationship', item.relation);
				
					});
				}else{
					cur_frm.clear_table('ltc_claimed');
				}
				
				cur_frm.refresh_field('ltc_claimed');
	
			}
		});
	},

	leave_encashment:function(frm){
		//frm.toggle_display("leave_application", true);
		
		if (frm.doc.leave_encashment && frm.doc.leave_application) {
			frm.trigger("check_applied_ltc");
			frm.toggle_display("encashment_days", true);
			frm.trigger("check_El_Balance");
		}
		// else{
		// 	frappe.msgprint('please Select the Leave application')
		// 	frm.set_value("leave_encashment", "")
		// }
	},
	check_El_Balance:function(frm){
	
		var Application_data = get_application_details(frm.doc.leave_application);

		console.log("Application_datasss",Application_data);
		frappe.call({
			method: "hrms.hr.doctype.leave_application.leave_application.get_leave_balance_on",
			args: {
				employee: frm.doc.employee,
				date: Application_data.from_date,
				to_date: Application_data.to_date,
				leave_type: 'Earned Leave',
				consider_all_leaves_in_the_allocation_period: true
			},
			callback: function (r) {
				var data = r.message;
				if (data) {
	
					var total_EL_balance = data;
					var total_leave_days = frm.doc.leave_days;
					var encashment_days = frm.doc.encashment_days;
					console.log("CHECK EL",total_EL_balance,total_leave_days,encashment_days);
					if (frm.doc.leave_type_name == 'Vacation Leave'){

						var vacation_leave_after_deduction_El_balance = total_EL_balance - total_leave_days / 2 - encashment_days;
	
						console.log(vacation_leave_after_deduction_El_balance);
	
						if (vacation_leave_after_deduction_El_balance <= 30) {
	
							frappe.msgprint(__(" There is not enough Earned leave balance for Encashment."));
							frm.set_value("leave_encashment", "")
							frm.set_value("encashment_days", "");
							frm.toggle_display("encashment_days", false);
						}
	
					}else{
	
						var other_leave_after_deduction_El_balance = total_EL_balance - encashment_days;
	
						console.log(other_leave_after_deduction_El_balance);
	
						if (other_leave_after_deduction_El_balance <= 30) {
	
							frappe.msgprint(__(" There is not enough Earned leave balance for Encashment."));
							frm.set_value("leave_encashment", "")
							frm.set_value("encashment_days", "");
							frm.toggle_display("encashment_days", false);
						}
	
					}
	
				}
			}
		});
	},

	ltc_advance_amount:function(frm){
		var advance_amount = frm.doc.ltc_advance_amount;

		var ninety_percent_ltc_amount = advance_amount *90/100;

		frm.set_value('ninety_percent_ltc_amount',ninety_percent_ltc_amount);

		console.log(frm.doc.ninety_percent_ltc_amount)
	},

	check_applied_ltc:function(frm){

		frappe.call({
			method: "frappe.client.get_list",
			args: {
				doctype: "LTC Request",
				filters: {
					"employee":frm.doc.employee,
					"docstatus":1,
					"status":'Approved'
				},
				fieldname: ["*"]
			},
			async: false,
			callback: function(r){
				var Ltc_data =r.message;

				if(Ltc_data.length >= 6){
					frappe.msgprint("You Already Applied 6 time Enchasmnt in a service")
					frm.set_value("leave_encashment", "")
					frm.set_value("encashment_days", "");
					frm.toggle_display("encashment_days", false);
				}
			} 
		});
	},
	document_cancel:function(frm){
		frm.add_custom_button(__('Cancel'), function () {
			let action_type = 'Cancelled';
			let user_details = frappe.session.user;
			
			doc_cancel_with_reasone(frm,action_type,user_details);

		}).addClass("btn-primary").css({ 'color': '#ffffff', 'font-weight': 'bold', 'background-color': '#2a07ff99' });
	},
	
});
function reject_with_resone(frm){
	console.log(frm.doc);
	var d = new frappe.ui.Dialog({
		title: __('Reason for Reject'),
		fields: [
			{
				"fieldname": "reason_for_reject",
				"fieldtype": "Text",
				"reqd": 1,
			}
		],
		primary_action: function() {
			var data = d.get_values();
			let reason_for_reject = 'Reason for Reject: ' + data.reason_for_reject;

			frappe.call({
				method: "frappe.desk.form.utils.add_comment",
				args: {
					reference_doctype: frm.doc.doctype,
					reference_name: frm.doc.name,
					content: __(reason_for_reject),
					comment_email: frappe.session.user,
					comment_by: frappe.session.user_fullname
				},
				callback: function(r) {
					if(!r.exc) {
						frm.set_value("reject_comment",data.reason_for_reject)
						let action_type = "Rejected"
						change_status_LTC(frm,action_type,frm.doc.approver);
						d.hide();
						//cur_frm.reload_doc();
					}
				}
			});
		}
	});
	d.show();
}

function get_application_details(name){
    var Leave_Application = [];
	
	frappe.call({
		method: "frappe.client.get_value",
		args: {
			doctype: "Leave Application",
			filters: {
				"name":name
			},
			fieldname: ["*"]
		},
		async: false,
		callback: function(r){
	        Leave_Application=r.message;
		} 
	});

    return Leave_Application;
}

function get_age(birth){

	var ageMS = Date.parse(Date()) - Date.parse(birth);
	var age = new Date();
	age.setTime(ageMS);
	var years = age.getFullYear() - 1970;
	//return years + " Year(s) " + age.getMonth() + " Month(s) " + age.getDate() + " Day(s)";
	return years;

}

function set_approver(frm){
	var employee = frm.doc.employee;
	var leave_type_name = frm.doc.leave_type_name;
	var emp_main_department =frm.doc.department;

	console.log(leave_type_name);
	
		frappe.call({
			"method": "frappe.client.get_list",
			"args": {
				doctype: "Employee Position Details",
				filters: [
					["parent", "=", employee]
				],
				parent: 'Employee',
				fields:["position","department"],
			},
			"async": false,
			"callback": function (response) {
				var position_data = response.message;
				var positions = [];//create position array to check employee position
				var pd = [];//create position array with department, position as a key and department as a value
			
				if (position_data.length>0){
					position_data.forEach(function (item) {
						positions.push(item.position);
						pd[item.position] = item.department;
					});//end foreach
					//console.log(positions,pd);
					if(positions.length>0){
						var emp_position = "";
						var emp_department = "";
						if(positions.indexOf("Faculty Members") !== -1){
							emp_position = "Faculty Members";
							emp_department = pd['Faculty Members'];
						}

						var leave_authority = get_leave_authority(emp_position,leave_type_name);
						var authority_count = Object.keys(leave_authority).length;
						var fst_r_pos = "";
						var snd_r_pos = "";
						var thrd_r_pos = ""
						var approver_pos = "";
						if(authority_count){
                            fst_r_pos = leave_authority.first_recommender;
							snd_r_pos = leave_authority.second_recommender;
							thrd_r_pos = leave_authority.third_recommender;
							approver_pos = leave_authority.approver;
						}else{
							leave_authority = get_leave_authority(emp_position,"Other");

							
							if(Object.keys(leave_authority).length>0){
								fst_r_pos = leave_authority.first_recommender;
								snd_r_pos = leave_authority.second_recommender;
								thrd_r_pos = leave_authority.third_recommender;
								approver_pos = leave_authority.approver;
							}
						}

						console.log("leave_authority",leave_authority)

						console.log('first reco='+fst_r_pos);
						console.log('second reco='+snd_r_pos);
						console.log('third reco='+thrd_r_pos);
						console.log('approver ='+approver_pos);


						if(approver_pos){
							var approver_pos_email = get_employee_detail(emp_main_department,emp_department,approver_pos);
							if(approver_pos_email){
								cur_frm.set_value('approver',approver_pos_email);
							}else{
								cur_frm.set_value('approver','');
							}
						}else{
							cur_frm.set_value('approver','');
						}
						
					
					}//end if position.length
				}//end if positon_data.length
			}
		});
}

function get_leave_authority(position,leave_type){
	var leave_authority = [];
	frappe.call({
		method: "frappe.client.get_value",
		args: {
			doctype: "Leave Authority",
			filters: {
				"position":position,
				"leave_type":leave_type
			},
			fieldname: ["*"]
		},
		async: false,
		callback: function(r){
	        leave_authority=r.message;
		} 
	});
    return leave_authority;
}

function get_employee_detail(emp_main_department,position_department,position){
    var email = "";
	frappe.call({
		method: "admin_iiti.overrides.get_employee_by_position",
		async: false,
		args: {
			"postion_department": position_department,
			"position":position,
			"emp_main_department":emp_main_department
		},
		callback: function (r) {
			console.log("r.message",r.message);
		     if(r.message.length>0){
                email = r.message[0].user_id;
			 }
		}
	});
	return email;
}
function change_status_LTC(frm,action_type,user){
	frappe.call({
		method: "admin_iiti.admin_iiti.doctype.ltc_request.ltc_request.update_LTC_status",
		async: true,
		args: {
			doctype :frm.doc.doctype,
			document_name: frm.doc.name,
			status: action_type,
			user: user,
		},
		callback: function (r) {
			let data = r.message;
			if(data == 'Processed'){
				cur_frm.set_value('status',data);
				frm.set_value('ltc_processed_by',user);
				frm.set_value('ltc_processed_date_time',frappe.datetime.now_datetime());
				cur_frm.save();
			}else if(data == 'Checked'){
				cur_frm.set_value('status',data);
				frm.set_value('ltc_checked_by',user);
				frm.set_value('ltc_checked_date_time',frappe.datetime.now_datetime());
				cur_frm.save();
			}else if(data == 'Recommended'){
				cur_frm.set_value('status',data);
				frm.set_value('ltc_recommended_by',user);
				frm.set_value('ltc_recommended_date_time',frappe.datetime.now_datetime());
				cur_frm.save();
			}else if(data == 'Sanction'){
				cur_frm.set_value('status',data);
				frm.set_value('ltc_approved_by',user);
				frm.set_value('ltc_approved_date_time',frappe.datetime.now_datetime());
				frm.savesubmit();
			}else if(data == 'Rejected'){
				cur_frm.set_value('status',data);
				frm.set_value('ltc_approved_by',user);
				frm.set_value('ltc_approved_date_time',frappe.datetime.now_datetime());
				frm.savesubmit();
			}
			//window.reload();
			//frm.reload_doc();
			//frm.refresh();
		
		}
	});
}
function doc_cancel_with_reasone(frm,action_type,user){
	var d = new frappe.ui.Dialog({
		title: __('Reason for Cancel'),
		fields: [
			{
				"fieldname": "reason_for_cancel",
				"fieldtype": "Text",
				"reqd": 1,
			}
		],
		primary_action: function() {
			var data = d.get_values();
			let reason_for_cancel = 'Reason for Cancel: ' + data.reason_for_cancel;

			frappe.call({
				method: "frappe.desk.form.utils.add_comment",
				args: {
					reference_doctype: frm.doc.doctype,
					reference_name: frm.doc.name,
					content: __(reason_for_cancel),
					comment_email: user,
					comment_by: frappe.session.user_fullname
				},
				callback: function(r) {
					if(!r.exc) {
						doc_cancel(frm,action_type,user,reason_for_cancel);
						d.hide();
						cur_frm.reload_doc();
					}
				}
			});
		}
	});
	d.show();
}
function doc_cancel(frm,action_type,user,reason_for_cancel){
	if(user){
		frappe.call({
			"method": 'admin_iiti.admin_iiti.doctype.ltc_request.ltc_request.cancel_doc',
			"args": {
				"contant": reason_for_cancel,
				"email_id":user,
				"doctype":frm.doc.doctype,
				"docname":frm.doc.name,
				"action":action_type
			},
			"async": false,
			callback: function (r) {
				let data = r.message;
				console.log(data);
				if (data == 'update') {
					frappe.msgprint("Document Successfully Cancelled");
					cur_frm.refresh();
				}else{
					frappe.msgprint("Invaild Request");
					cur_frm.refresh();
				}
			}
		});
	}
}
