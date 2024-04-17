frappe.listview_settings['IIT Form'] = {
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
        else {
            return [__("Open"), "red", "status,=,Open"];
        }
    },
}