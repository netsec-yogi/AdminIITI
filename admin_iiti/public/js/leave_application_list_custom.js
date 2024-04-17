if (frappe.user.has_role('Leave Approver')) {
	let session_user = frappe.session.user;
	frappe.listview_settings['Leave Application'] = {
		add_fields: ["leave_type", "employee", "employee_name", "total_leave_days", "from_date", "to_date"],
        //filters: [["status", "=", '']],
		// filters: [
		// 	['leave_recommender', '=', session_user]
		// ],
		onload: function(listview) {
			
			frappe.route_options = {
				"status": ["=",""]
			};
			
		},
		has_indicator_for_draft: 1,

		get_indicator: function (doc) {
			//console.log(frappe.session.user);
			if (doc.status === "Approved") {
				return [__("Approved"), "green", "status,=,Approved"];
			} else if (doc.status === "Rejected") {
				return [__("Rejected"), "red", "status,=,Rejected"];
			}
			else if (doc.status === "Recommended") {
				return [__("Recommended"), "yellow", "status,=,Recommended"];
			}
			else if (doc.status === "Cancelled") {
				return [__("Cancelled"), "red", "status,=,Cancelled"];
			}
			 else {
				return [__("Open"), "red", "status,=,Open"];
			}
		},
	}
}else{
	frappe.listview_settings['Leave Application'] = {
		add_fields: ["leave_type", "employee", "employee_name", "total_leave_days", "from_date", "to_date"],
        filters: [["status", "=", '']],
		has_indicator_for_draft: 1,
		get_indicator: function (doc) {
		//	console.log(doc);
			if (doc.status === "Approved") {
				return [__("Approved"), "green", "status,=,Approved"];
			} else if (doc.status === "Rejected") {
				return [__("Rejected"), "red", "status,=,Rejected"];
			}
			else if (doc.status === "Recommended") {
				return [__("Recommended"), "yellow", "status,=,Recommended"];
			}
			else if (doc.status === "Cancelled") {
				return [__("Cancelled"), "red", "status,=,Cancelled"];
			}
			 else {
				return [__("Open"), "red", "status,=,Open"];
			}
		},
	}
}