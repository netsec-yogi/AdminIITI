frappe.listview_settings['Leave cancel Request'] = {
	has_indicator_for_draft: 1,
	get_indicator: function (doc) {
		if (doc.status === "Approved") {
			return [__("Approved"), "green", "status,=,Approved"];
		} else if (doc.status === "Not Approved") {
			return [__("Not Approved"), "red", "status,=,Not Approved"];
		} else {
			return [__("Open"), "red", "status,=,Open"];
		}
	},
};