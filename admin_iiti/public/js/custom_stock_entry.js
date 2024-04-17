cur_frm.add_fetch('items');
$("[data-fieldname*=scan_barcode]").on('keyup', function(e) { 
    var keyCode = e.keyCode || e.which; 
    if (keyCode == 9) {
       e.preventDefault();
    //    var d = new frappe.ui.Dialog({});
    // var d = new frappe.ui.Dialog({});
    // $( ".grid-row-open" ).html("");
    // d.show() 
    // d.hide()
    $( "div" ).removeClass( "grid-row-open").add('grid-row');
 //   var link = document.getElementsByClassName('grid-add-row');
       //  link.click();
       // add_new_row(null, null, true, null, true);
		//	this.set_focus_on_row();
    //  alert('Tab Pressed');
  
    $(".data-row").removeAttr("style");

  //  $("data-fieldname='item_code'").focus();
  //  $( ".grid-add-row" ).first().trigger( "click" );
   // $(".row-index sortable-handle col").html("");
  //  $(".row-index sortable-handle col").html("<span>1</span>");
    frappe.dom.unfreeze();
    //cur_frm.refresh_field('items');
    $("input[data-fieldname=item_code]").trigger( "click" );
    $("input[data-fieldname=item_code]").focus();
    e.preventDefault();
}
        // $( "div" ).removeClass( "form-in-grid");
     
     
        
       
        // this.dialog.hide();
    //    grid-row grid-row-open
      
   
  }); 