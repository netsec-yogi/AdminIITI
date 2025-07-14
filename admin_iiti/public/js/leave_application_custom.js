frappe.ui.form.on("Leave Application", {
	setup: function(frm) {
		if(frm.is_new()){
			var today = new Date();
			var yyyy = today.getFullYear();
			cur_frm.set_value("year",yyyy);
		}
		frm.set_query("leave_approver", function() {
			return {
				query: "admin_iiti.overrides.get_approvers",
				filters: {
					'enabled': 1,
					'name': ['not in', [frappe.session.user]],
				}
			};
		});
		cur_frm.fields_dict.other_leave_type.get_query = function(doc) {
			return {
				filters: {
					status:'Active'
				},
				order_by: 'creation DESC',
			}
		}

		frm.set_query("employee", erpnext.queries.employee);
	},
	refresh:function(frm){
		let logged_user = frappe.session.user;
		if(frappe.session.user == 'hrmanager@iiti.ac.in' || frappe.session.user == 'Administrator'){
			frm.toggle_display('status',true);
			frm.toggle_display('follow_via_email',true);
		}else{
			frm.disable_save();
		}
		if (!frm.is_new()) {
			if(frm.doc.status == 'Rejected'){
				frm.toggle_display('recommended',false);
				frm.toggle_display('approved',false);
				frm.toggle_display('not_recommended',false);
				frm.toggle_display('not_approved',false);
			}
			frm.toggle_display('submit_form',false);
			if(frm.doc.leave_balance == 0){
				frm.toggle_display("leave_balance",false);
			}
			if((frm.doc.owner == logged_user || logged_user == 'hrmanager@iiti.ac.in') && (frm.doc.status == 'Open' || frm.doc.status == 'Recommended')){
				frm.add_custom_button(__('Cancel Leave'), 
				() => cancel_leave_application(frm)).addClass("btn-danger")
				.css({ 'color': '#ffffff', 'font-weight': 'bold', 'background-color': '#17a2b8' });
			}
			frm.trigger("default_discussion_button");
			// if(frm.doc.leave_approver == logged_user && frm.doc.status == 'Approved'){
			// 	frm.disable_form();
			// 	frm.toggle_display('approved',false);
			// 	frm.toggle_display('not_approved',false);
			// }
		}else{
			frm.toggle_display('submit_form',true);
			document.querySelectorAll("[data-fieldname='submit_form']")[1].style.backgroundColor="#00b2ff";
		}
	},
	onload: function(frm) {
		let logged_user = frappe.session.user;
		if(frappe.session.user == 'hrmanager@iiti.ac.in' || frappe.session.user == 'Administrator'){
			frm.toggle_display('status',true);
			frm.toggle_display('follow_via_email',true);
		}else{
			frm.disable_save();
			
		}
		if (!frm.is_new()) {
			frm.toggle_display('submit_form',false);
			if (frm.doc.leave_recommenders) {
				frm.doc.leave_recommenders.forEach(function (list) {
					if (logged_user == list.recommender && list.status == 'Open') {
						frm.disable_form();
						frm.toggle_display('recommended',true);
						frm.toggle_display('not_recommended',true);
						document.querySelectorAll("[data-fieldname='recommended']")[1].style.backgroundColor="#00b2ff";
						document.querySelectorAll("[data-fieldname='not_recommended']")[1].style.backgroundColor="#ff0000";
			
					}
					if(logged_user == list.recommender && list.status == 'Recommended'){
						frm.disable_form();
						frm.toggle_display('recommended',false);
						frm.toggle_display('not_recommended',false);

						frm.add_custom_button(__('Recommended'), function () {

							frappe.msgprint('leave already recommended');
		
						}).addClass("btn-info").css({ 'color': '#ffffff', 'font-weight': 'bold', 'background-color': '#1eb817ab' })
					}
				});
				
			}
			if(frm.doc.leave_approver == logged_user && (frm.doc.status == 'Open' || frm.doc.status == 'Recommended')){
				frm.disable_form();
				frm.toggle_display('approved',true);
				frm.toggle_display('not_approved',true);
				document.querySelectorAll("[data-fieldname='approved']")[1].style.backgroundColor="#008000";
				document.querySelectorAll("[data-fieldname='not_approved']")[1].style.backgroundColor="red";
			}
			if(frm.doc.leave_approver == logged_user && frm.doc.status == 'Approved'){
				frm.disable_form();
				frm.toggle_display('approved',false);
				frm.toggle_display('not_approved',false);
			}

			if((frm.doc.owner == logged_user || logged_user == 'hrmanager@iiti.ac.in') && (frm.doc.status == 'Open' || frm.doc.status == 'Recommended')){
				frm.add_custom_button(__('Cancel Leave'), 
				() => cancel_leave_application(frm)).addClass("btn-danger")
				.css({ 'color': '#ffffff', 'font-weight': 'bold', 'background-color': '#17a2b8' });
			}
			frm.trigger("default_discussion_button");
		}else{
			frm.toggle_display('submit_form',true);
			document.querySelectorAll("[data-fieldname='submit_form']")[1].style.backgroundColor="#00b2ff";
		}
		//-----core data -----///
		// Ignore cancellation of doctype on cancel all.
		frm.ignore_doctypes_on_cancel_all = ["Leave Ledger Entry"];

		if (!frm.doc.posting_date) {
			frm.set_value("posting_date", frappe.datetime.get_today());
		}
		if (frm.doc.docstatus == 0) {
			return frappe.call({
				method: "hrms.hr.doctype.leave_application.leave_application.get_mandatory_approval",
				args: {
					doctype: frm.doc.doctype,
				},
				callback: function(r) {
					if (!r.exc && r.message) {
						frm.toggle_reqd("leave_approver", true);
					}
				}
			});
		}
		//----- End core data -----///
	},
	leave_approver : function(frm) {
		if (frm.doc.leave_approver) {			
			frappe.db.get_value('User', {'name': frm.doc.leave_approver}, 'full_name', (d) =>{
				frm.set_value("leave_approver_name",d.full_name);
			})
			let data = employee_data(frm.doc.leave_approver);
			frm.set_value("approver_designation",data.designation);
			frm.toggle_display("approver_designation",true);
			if(frm.doc.leave_approver == frappe.session.user){
				frappe.msgprint("Invalid leave approver name selected.");
				frm.set_value("leave_approver"," ");
				frm.set_value("leave_approver_name"," ");
			}
			
		}
    },
	leave_type:function(frm){

		if(frm.doc.leave_type == 'Casual Leave'){
			frm.toggle_display("half_day",true);
			frm.toggle_display("choose_session",true);
		}else if(frm.doc.leave_type == 'Other Leave'){
			frm.set_value('other_leave_type','');
			frm.toggle_display("half_day",false);
			frm.toggle_display("choose_session",false);
		}else{
			frm.set_value('total_leave_days','')
			frm.set_value('half_day','');
			frm.toggle_display("half_day",false);
			frm.toggle_display("choose_session",false);
		}
		
		frm.trigger("calculate_total_days");
		frm.trigger("get_leave_balance");
	},
	from_date: function(frm){
		//set to date is not less than from date
		var from_date = new Date(frm.doc.from_date);
		var day = from_date.getDate();
		var year = from_date.getFullYear();
		var month = from_date.getMonth()+1;
		cur_frm.fields_dict.to_date.datepicker.update({
		 minDate: new Date(year, month - 1, day)
		});
		//set to date is not less than from date
 	},
	to_date:function(frm){
		if(frm.doc.to_date && frm.doc.other_leave_type == 'Headquarter Leave'){
			frm.trigger("get_holiday_list");
			frm.trigger("get_leave_days");
		
		}
	},
	prefix_from_date:function(frm){

		var from_date = new Date(frm.doc.prefix_from_date);
		var day = from_date.getDate();
		var year = from_date.getFullYear();
		var month = from_date.getMonth()+1;
		cur_frm.fields_dict.prefix_to_date.datepicker.update({
		minDate: new Date(year, month - 1, day)
		});

	},
	prefix_to_date:function(frm){
		if(frm.doc.prefix_leave_date && frm.doc.prefix_from_date && frm.doc.prefix_to_date){
			var holiday_list
			frappe.call({
				method: "frappe.client.get_value",
				args: {
					doctype: "Company",
					fieldname: "default_holiday_list"
				},
				callback: function(r){
					holiday_list = r.message.default_holiday_list;
					if(holiday_list){
						check_prefix(frm,holiday_list,frm.doc.prefix_from_date,frm.doc.prefix_to_date);
					}else{
						frappe.msgprint("Please set the default holiday list for current year");
					}
					
				}
			});

		}
	},
	get_holiday_list:function(frm){
		if(frm.doc.from_date && frm.doc.to_date){
			var holiday_list
			frappe.call({
				method: "frappe.client.get_value",
				args: {
					doctype: "Company",
					fieldname: "default_holiday_list"
				},
				callback: function(r){
					holiday_list = r.message.default_holiday_list;
					console.log("holiday_list",holiday_list);
					if(holiday_list){
						check_holidays(frm,holiday_list,frm.doc.from_date,frm.doc.to_date);
					}else{
						frappe.msgprint("Please set the default holiday list for current year");
					}
					
				}
			});

		}
	},
	check_RH_holiday:function(frm){
		frappe.call({
			method: "frappe.client.get_list",
			args: {
				doctype: "Holiday",
				filters: {
					"parent":'RH Holiday 2024',
					"holiday_date":["between", [frm.doc.from_date,frm.doc.to_date]],
				},
				fields: ["holiday_date"],
				parent:"Holiday List"
				
			},
			callback: function(r){
				var data = r.message;
				if(data.length == 0){
					frappe.msgprint("Headquarter Leave only apply on the holidays");
					frm.set_value('from_date',"");
					frm.set_value('to_date',"");
					frm.set_value('total_leave_days',"");
	
				}
			}
		});
	},
	suffix_from_date:function(frm){

		var from_date = new Date(frm.doc.suffix_from_date);
		var day = from_date.getDate();
		var year = from_date.getFullYear();
		var month = from_date.getMonth()+1;
		cur_frm.fields_dict.suffix_to_date.datepicker.update({
		minDate: new Date(year, month - 1, day)
		});

	},
	suffix_to_date:function(frm){
		if(frm.doc.suffix_leave_date && frm.doc.suffix_from_date && frm.doc.suffix_to_date){
			var holiday_list
			frappe.call({
				method: "frappe.client.get_value",
				args: {
					doctype: "Company",
					fieldname: "default_holiday_list"
				},
				callback: function(r){
					holiday_list = r.message.default_holiday_list;
					if(holiday_list){
						check_suffix(frm,holiday_list,frm.doc.suffix_from_date,frm.doc.suffix_to_date);
					}else{
						frappe.msgprint("please set the default holiday list for current year");
					}
				}
			});

		}
	},
	get_leave_balance: function(frm) {
        if (frm.doc.docstatus === 0 && frm.doc.employee && frm.doc.leave_type && frm.doc.from_date && frm.doc.to_date) {
            if(frm.doc.leave_type == 'Commuted Leave'){
                var leave_ty = 'Half Paid Leave';
            }else{
                var leave_ty = frm.doc.leave_type;
            }
            return frappe.call({
                method: "hrms.hr.doctype.leave_application.leave_application.get_leave_balance_on",
                args: {
                    employee: frm.doc.employee,
                    date: frm.doc.from_date,
                    to_date: frm.doc.to_date,
                    leave_type: leave_ty,
                    consider_all_leaves_in_the_allocation_period: 1
                },
                callback: function (r) {
                    if (!r.exc && r.message) {
                        frm.set_value('leave_balance', r.message);
                    } else {
                        frm.set_value('leave_balance', "0");
						frm.toggle_display("leave_balance",false);
                    }
                }
            });
        }
    },
	submit_form:function(frm){
		if(frm.doc.status == 'Open'){
			cur_frm.save();
		}
	},
	approved:function(frm){
		var action_type = "Approved"
		doc_status_update(frm,action_type);
	},
	recommended:function(frm){
		var action_type = "Recommended";
		change_leave_status(frm,action_type);
	},
	contact_number:function(frm){
		if(frm.doc.contact_number){
			let value = validate_number(frm.doc.contact_number);
			if(value){
				frm.set_value("contact_number",'');
			}
		}
	},
	not_approved: function(frm) {
		var action_type = 'Rejected';
		change_leave_status(frm,action_type);
	},
	not_recommended: function(frm) {
		var action_type = 'Rejected';
		change_leave_status(frm,action_type);
	},
	make_dashboard: function(frm) {
		var leave_details;
		let lwps;
		if (frm.doc.employee) {
			frappe.call({
				method: "hrms.hr.doctype.leave_application.leave_application.get_leave_details",
				async: false,
				args: {
					employee: frm.doc.employee,
					date: frm.doc.from_date || frm.doc.posting_date
				},
				callback: function(r) {
					if (!r.exc && r.message['leave_allocation']) {
						leave_details = r.message['leave_allocation'];
					}
					lwps = r.message["lwps"];
				}
			});
			
			// this is used to html template code render for  leave application dashborad call 
			$("div").remove(".form-dashboard-section.custom");
			var data = leave_details
			var template = '{% if not jQuery.isEmptyObject(data) %}<div class="row">{% for(const [key, value] of Object.entries(data)) { %}<div class="col-lg-3 col-sm-6" style="position: relative;max-width: 24%;background-color: #17a2b83d;background-clip: border-box;border: 2px solid rgb(35 40 47 / 13%);border-radius: 0.75rem;"><div class="circle-tile "><div class="circle-tile-content blue"><div class="circle-tile-description text-faded" style="font-weight: 700;">{%= key %}</div><a class="circle-tile-footer" href="">{%= value["remaining_leaves"] %}<iclass="fa fa-chevron-circle-right"></i></a></div></div></div>&nbsp;{% } %}</div></div>{% else %}<p style="margin-top: 30px;"> No Leave has been allocated. </p>{% endif %}'
			frm.dashboard.add_section(
				frappe.render_template(template, {
					data: leave_details
				}),
				__("Leave Balanced")
			);
			frm.dashboard.show();
			let allowed_leave_types = Object.keys(leave_details);
			// lwps should be allowed, lwps don't have any allocation
			allowed_leave_types = allowed_leave_types.concat(lwps);

			frm.set_query('leave_type', function() {
				return {
					filters: [
						['leave_type_name', 'in', allowed_leave_types]
					]
				};
			});
		}
	},
	get_leave_days:function(frm){
		return frappe.call({
			method: 'admin_iiti.overrides.get_date_diff',
			args: {
				"employee": frm.doc.employee,
				"leave_type": frm.doc.leave_type,
				"from_date": frm.doc.from_date,
				"to_date": frm.doc.to_date,
				"other_leave_type":frm.doc.other_leave_type,
			},
			callback: function(r) {
				if (r && r.message) {
					frm.set_value('total_leave_days', r.message);
					frm.trigger("get_leave_balance");
				}
			}
		});
	},
	default_discussion_button:function(frm){
		frm.add_custom_button(__("Discussion"), function () {
			frm.trigger("discussion_remark");
		}).addClass("btn-info").css({ 'color': '#ffffff', 'font-weight': 'bold', 'background-color': '#333c44' });
	},
	discussion_remark:function(frm){
		var d = new frappe.ui.Dialog({
			title: __('Discussion'),
			fields: [
				{
					"fieldname": "employee",
					"fieldtype": "Link",
					"default":frm.doc.owner,
					"reqd": 1,
					"label": "Employee",
					"options": "User",
					//"read_only": 1
				},
				{
					"fieldname": "remark",
					"fieldtype": "Text",
					"reqd": 1,
				}
			],
			primary_action: function() {
				var data = d.get_values();
				let remark = 'Discussion: ' + data.remark;
				let user_id = data.employee;
	
				frappe.call({
					method: "frappe.desk.form.utils.add_comment",
					args: {
						reference_doctype: frm.doc.doctype,
						reference_name: frm.doc.name,
						content: __(remark),
						comment_email: frappe.session.user,
						comment_by: frappe.session.user_fullname
					},
					callback: function(r) {
						if(!r.exc) {
							send_email_for_discussion(frm,remark,user_id);
							d.hide();
							cur_frm.reload_doc();
						}
					}
				});
			}
		});
		d.show();
	},
});
function change_leave_status(frm,action_type) {
	frappe.call({
		method: "admin_iiti.overrides.set_leave_status",
		args: {
			leave_application_name: frm.doc.name,
			doctype:frm.doc.doctype,
			user:frappe.session.user,
			action_type: action_type,
			leave_type:frm.doc.leave_type_name,
		},
		callback: function (r) {
			var status = r.message;
			console.log("status",status);
			if(status == 'Open'){
				var child_doc_status = 'Recommended';
				frm.set_value('status',status);
				update_child_data(frm, child_doc_status);
				cur_frm.reload_doc();
				frappe.msgprint("Thank you for recommended the leave application. ");
			}else if(status == 'Recommended'){
				var child_doc_status = 'Recommended';
				frm.set_value('status',status);
				update_child_data(frm, child_doc_status);
				cur_frm.save();
				frappe.msgprint("Thank you for recommended the leave application. ");
			}else{
				var child_doc_status = 'Rejected';
				frm.set_value('status',status);
				update_child_data(frm, child_doc_status);
				cur_frm.save();
				cur_frm.reload_doc();
				frappe.msgprint("Leave application has been rejected. ")
			}
			
		
		}
	});
}
function doc_status_update(frm,action_type) {
	frm.set_value("status",action_type);
	frm.set_value("doc_approved_date",frappe.datetime.now_datetime());
	frm.savesubmit();
	// frm.reload_doc();
	return action_type;

}

function update_child_data(frm, child_doc_status){
	frm.refresh_field("leave_recommenders");
	let recommender = frm.doc.leave_recommenders;
	let datetime = frappe.datetime.now_datetime();
	if (recommender.length > 0) {
		recommender.forEach(function (i, d) {
			if (i.recommender == frappe.session.user && i.status == 'Open') {
				var val = recommender[d];
				val.status = child_doc_status;
				val.recommend_date_time = datetime;
				val.docstatus = 1;
			}
		});
		cur_frm.refresh_field('leave_recommenders');
	} else {
		cur_frm.clear_table('leave_recommenders');
	}
}

frappe.ui.form.on('Leave Recommender', 'recommender', function (frm, cdt, cdn) {
	var val = locals[cdt][cdn];
	if(val.recommender == frappe.session.user){
		frappe.msgprint("invalid Recommender selected");
		val.recommender = ""
		cur_frm.clear_table('leave_recommenders');
	}
	let data = employee_data(val.recommender);
	val.recommender_name = data.salutation+'. '+data.employee_name;
	val.department = data.department;
	val.designation = data.designation;	
	frm.refresh_field("leave_recommenders");

});
//p:validation:unique Recommender member select 
frappe.ui.form.on('Leave Recommender', 'recommender', function (frm, cdt, cdn) {

	frm.fields_dict['leave_recommenders'].grid.get_field('recommender').get_query = function (doc) {

		let recommender_list = [frappe.session.user];

		$.each(doc.leave_recommenders, function (idx, val) {
			recommender_list.push(val.recommender);
		});

		return {
			filters: {
				name: ['not in', recommender_list],
			}
		};
	};

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

function validate_number(inputtxt){
	/**
	 * Checks if the input is a valid number.
	 * 
	 * @param {string} inputtxt - The input to be validated as a number.
	 * @returns {boolean} - Returns true if the input is not a valid number, false otherwise.
	 */
	var value = /^[0-9]*$/;
	if (inputtxt.match(value)) {
		return false;
	}else{
		frappe.msgprint('Please input Number only');
		return true;
	}
}
function check_prefix(frm,holiday_list,from_date,to_date){

	frappe.call({
		method: "frappe.client.get_list",
		args: {
			doctype: "Holiday",
			filters: {
				"parent":holiday_list,
				"holiday_date":["between", [from_date,to_date]],
				
			},
			fields: ["holiday_date"],
			parent:"Holiday List"
			
		},
		callback: function(r){
			var data = r.message;
			if(data.length == 0){

				frappe.msgprint("Prefix leaves dates are incorrect.");
				frm.set_value('prefix_leave_date','');
				frm.set_value('prefix_from_date','');
				frm.set_value('prefix_to_date','');

			}
		}
	});

}
function check_holidays(frm,holiday_list,from_date,to_date) {
	frappe.call({
		method: "frappe.client.get_list",
		args: {
			doctype: "Holiday",
			filters: {
				"parent":holiday_list,
				"holiday_date":["between", [from_date,to_date]],
			},
			fields: ["holiday_date"],
			parent:"Holiday List"
			
		},
		callback: function(r){
			var data = r.message;
			if(data.length == 0){
				frappe.msgprint("Headquarter Leave only apply on the holidays");
				frm.set_value('from_date',"");
				frm.set_value('to_date',"");
				frm.set_value('total_leave_days',"");

			}
			frm.trigger("make_dashboard");
			frm.trigger("half_day_datepicker");
			frm.trigger("calculate_total_days");
		}
	});
}

function check_suffix(frm,holiday_list,from_date,to_date){

	frappe.call({
		method: "frappe.client.get_list",
		args: {
			doctype: "Holiday",
			filters: {
				"parent":holiday_list,
				"holiday_date":["between", [from_date,to_date]],
				
			},
			fields: ["holiday_date"],
			parent:"Holiday List"
			
		},
		callback: function(r){
			var data = r.message;
			if(data.length == 0){

				frappe.msgprint("Suffix leaves dates are incorrect.");
				frm.set_value('suffix_leave_date','');
				frm.set_value('suffix_from_date','');
				frm.set_value('suffix_to_date','');

			}
		}
	});

}
function cancel_leave_application(frm){
	var d = new frappe.ui.Dialog({
		title: __('Reason for cancel leave application'),
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
			update_leave_doc(frm,reason_for_cancel);

			frappe.call({
				method: "frappe.desk.form.utils.add_comment",
				args: {
					reference_doctype: frm.doc.doctype,
					reference_name: frm.doc.name,
					content: __(reason_for_cancel),
					comment_email: frappe.session.user,
					comment_by: frappe.session.user_fullname
				},
				callback: function(r) {
					if(!r.exc) {
						update_leave_doc(frm,reason_for_cancel);
						d.hide();
						cur_frm.reload_doc();
					}
				}
			});
		}
	});
	d.show();
}
function update_leave_doc(frm,reason_for_cancel){
	if(reason_for_cancel){
		frappe.call({
			"method": 'admin_iiti.overrides.cancel_leave_application',
			"args": {
				"employee":frm.doc.employee,
				"doctype":frm.doc.doctype,
				"docname":frm.doc.name,
				"docstatus":frm.doc.status,
				"reason_for_cancel":reason_for_cancel,
				"status":'Cancelled'
			},
			"async": false,
			callback: function (r) {
				let data = r;
				if (data) {
					frm.set_value('status','Cancelled');
					//frm.save();
					frappe.msgprint("Your Leave application cancelled sucessfully");
				}
			}
		});
	}
}
function send_email_for_discussion(frm,remark,user_id){
	if(remark){
		frappe.call({
			"method": 'admin_iiti.overrides.leave_discussion_email_send',
			"args": {
				"contant": remark,
				"email_id":user_id,
				"doctype":frm.doc.doctype,
				"docname":frm.doc.name,
			},
			"async": false,
			callback: function (r) {
				let data = r.message;
				if (r && r.message) {
					doc.reload_doc();
				}
			}
		});
	}
}