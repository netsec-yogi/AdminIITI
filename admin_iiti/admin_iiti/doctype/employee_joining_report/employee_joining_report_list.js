frappe.listview_settings['Employee Joining Report'] = {
	add_fields: ["employee", "employee_name","employee_name"],
	has_indicator_for_draft: 1,
	get_indicator: function (doc) {
		if (doc.status === "Approved") {
			return [__("Approved"), "green", "status,=,Approved"];
		} else if (doc.status === "Not Approved") {
			return [__("Not Approved"), "red", "status,=,Not Approved"];
		}else if (doc.status === "Cancelled") {
			return [__("Cancelled"), "red", "status,=,Cancelled"];
		}
        else {
			return [__("Open"), "red", "status,=,Open"];
		}
	},
};