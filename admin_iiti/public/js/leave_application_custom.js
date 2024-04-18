frappe.ui.form.on("Leave Application", {
	setup: function(frm) {
		frm.set_query("leave_approver", function() {
			return {
				query: "admin_iiti.overrides.get_approvers",
				filters: {
					'enabled': 1
				}
			};
		});

		frm.set_query("employee", erpnext.queries.employee);
	},
	refresh:function(frm){
		if (!frm.is_new()) {
			
		}else{
			frm.disable_save();
		}
	},
	onload: function(frm) {
		if (!frm.is_new()) {
			
		}else{
			frm.disable_save();
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
			
		}
    },
	leave_type:function(frm){

		if(frm.doc.leave_type == 'Casual Leave'){
			frm.toggle_display("half_day",true);
		}else{
			frm.toggle_display("half_day",false);
		}
		frm.trigger("calculate_total_days");
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
					check_prefix(frm,holiday_list,frm.doc.prefix_from_date,frm.doc.prefix_to_date);
				}
			});

		}
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
					check_suffix(frm,holiday_list,frm.doc.suffix_from_date,frm.doc.suffix_to_date);
				}
			});

		}
	},
});