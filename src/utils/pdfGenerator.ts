import { jsPDF } from "jspdf";
import { Booking, Payment, Studio, PrintOrder } from "../db/types";

/**
 * Builds an Official Booking Receipt PDF document.
 */
export function buildBookingReceiptPDF(
  booking: Booking,
  studio?: Studio,
  payment?: Payment
) {
  const doc = new jsPDF({
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();

  // Header Banner
  doc.setFillColor(30, 41, 59); // Slate-800
  doc.rect(0, 0, pageWidth, 28, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(studio?.name || "CAINTA PHOTOGRAPHY STUDIO", 14, 12);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Official Booking Confirmation & Acknowledgement Receipt", 14, 18);
  doc.text("Cainta Studio Management Information System (MIS)", 14, 23);

  // Status Badge
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(pageWidth - 55, 8, 42, 12, 2, 2, "F");
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(`STATUS: ${booking.status.toUpperCase()}`, pageWidth - 52, 15);

  let y = 38;

  // Invoice & Customer Info Box
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text("BOOKING DETAILS", 14, y);
  doc.text("CUSTOMER DETAILS", 110, y);
  y += 5;

  doc.setLineWidth(0.3);
  doc.setDrawColor(226, 232, 240);
  doc.line(14, y, pageWidth - 14, y);
  y += 6;

  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(9);

  // Column 1 - Booking
  doc.text(`Booking Reference:`, 14, y);
  doc.setFont("helvetica", "normal");
  doc.text(booking.id, 50, y);

  doc.setFont("helvetica", "bold");
  doc.text(`Customer Name:`, 110, y);
  doc.setFont("helvetica", "normal");
  doc.text(booking.customerDetails.fullName, 145, y);
  y += 6;

  doc.setFont("helvetica", "bold");
  doc.text(`Shoot Date:`, 14, y);
  doc.setFont("helvetica", "normal");
  doc.text(booking.bookingDate, 50, y);

  doc.setFont("helvetica", "bold");
  doc.text(`Email Address:`, 110, y);
  doc.setFont("helvetica", "normal");
  doc.text(booking.customerDetails.email, 145, y);
  y += 6;

  doc.setFont("helvetica", "bold");
  doc.text(`Time Slot:`, 14, y);
  doc.setFont("helvetica", "normal");
  doc.text(booking.timeSlot, 50, y);

  doc.setFont("helvetica", "bold");
  doc.text(`Contact Number:`, 110, y);
  doc.setFont("helvetica", "normal");
  doc.text(booking.customerDetails.phone || "N/A", 145, y);
  y += 6;

  const leftAddressWidth = 42;
  const rightStatusWidth = 25;

  doc.setFont("helvetica", "bold");
  doc.text(`Studio Location:`, 14, y);
  doc.setFont("helvetica", "normal");
  const addressLines = doc.splitTextToSize(studio?.address || "Cainta, Rizal", leftAddressWidth);
  doc.text(addressLines, 50, y);

  doc.setFont("helvetica", "bold");
  doc.text(`Payment Status:`, 105, y);
  doc.setFont("helvetica", "normal");
  const paymentStatusLines = doc.splitTextToSize(booking.paymentStatus, rightStatusWidth);
  doc.text(paymentStatusLines, 128, y, { maxWidth: rightStatusWidth });

  const rightColumnOffset = Math.max(addressLines.length, paymentStatusLines.length) * 4.2;
  y += Math.max(6, rightColumnOffset + 2);

  // Itemized Pricing Table
  doc.setFillColor(248, 250, 252);
  doc.rect(14, y, pageWidth - 28, 8, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  doc.text("Description / Package Item", 18, y + 5.5);
  doc.text("Qty", 130, y + 5.5);
  doc.text("Amount (PHP)", pageWidth - 45, y + 5.5);
  y += 10;

  // Base Package row
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  doc.text("Photography Shoot Package", 18, y);
  doc.text("1", 132, y);
  doc.text(`PHP ${(booking.totalAmount - (booking.addons?.reduce((acc, a) => acc + (a.price * a.quantity), 0) || 0)).toLocaleString()}`, pageWidth - 45, y);
  y += 7;

  // Addons if any
  if (booking.addons && booking.addons.length > 0) {
    booking.addons.forEach((addon, i) => {
      doc.text(`Addon Service #${i + 1}`, 18, y);
      doc.text(String(addon.quantity), 132, y);
      doc.text(`PHP ${(addon.price * addon.quantity).toLocaleString()}`, pageWidth - 45, y);
      y += 7;
    });
  }

  doc.setLineWidth(0.3);
  doc.setDrawColor(226, 232, 240);
  doc.line(14, y, pageWidth - 14, y);
  y += 8;

  // Totals Summary
  const rightXLabel = 118;
  const rightXVal = pageWidth - 14;

  doc.setFont("helvetica", "bold");
  doc.text("Total Package Price:", rightXLabel, y);
  doc.text(`PHP ${booking.totalAmount.toLocaleString()}`, rightXVal, y, { align: "right" });
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.text("Amount Paid / Downpayment:", rightXLabel, y);
  doc.text(`PHP ${(booking.amountPaid || 0).toLocaleString()}`, rightXVal, y, { align: "right" });
  y += 6;

  const remainingBalance = Math.max(0, booking.totalAmount - (booking.amountPaid || 0));
  doc.setFont("helvetica", "bold");
  doc.setTextColor(remainingBalance > 0 ? 180 : 22, remainingBalance > 0 ? 83 : 101, remainingBalance > 0 ? 9 : 52);
  doc.text("Remaining Balance:", rightXLabel, y);
  doc.text(`PHP ${remainingBalance.toLocaleString()}`, rightXVal, y, { align: "right" });
  y += 12;

  // Payment Reference box if available
  if (payment?.referenceNumber) {
    doc.setFillColor(240, 253, 244);
    doc.roundedRect(14, y, pageWidth - 28, 14, 2, 2, "F");
    doc.setTextColor(22, 101, 52);
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.text("PAYMENT VERIFICATION RECORD", 18, y + 5);
    doc.setFont("helvetica", "normal");
    doc.text(`Method: ${payment.paymentMethod} | Reference No: ${payment.referenceNumber} | Date: ${new Date(payment.paymentDate).toLocaleDateString()}`, 18, y + 10);
    y += 20;
  }

  // Terms and Footer
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text("Terms & Conditions:", 14, y);
  y += 4;
  doc.text("1. Please arrive at least 10 minutes prior to your scheduled time slot.", 14, y);
  y += 4;
  doc.text("2. Rescheduling is permitted at least 48 hours prior to the photoshoot date.", 14, y);
  y += 4;
  doc.text("3. Remaining balance shall be settled on the day of the photoshoot at the studio counter.", 14, y);
  y += 12;

  // Stamp / Watermark text
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("CAINTA PHOTOGRAPHY STUDIO MIS - OFFICIAL DIGITAL RECEIPT", pageWidth / 2, y, { align: "center" });

  return doc;
}

export function generateBookingReceiptPDF(
  booking: Booking,
  studio?: Studio,
  payment?: Payment
) {
  const doc = buildBookingReceiptPDF(booking, studio, payment);
  doc.save(`Receipt_${booking.id}_CaintaMIS.pdf`);
}

/**
 * Builds a print-order receipt PDF that customers can download after placing a custom print request.
 */
export function buildPrintOrderReceiptPDF(
  order: PrintOrder,
  studio?: Studio,
  product?: { name?: string; size?: string; description?: string; price?: number }
) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 30, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("CUSTOM PRINT ORDER RECEIPT", 14, 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(studio?.name || "Cainta Photography Studio", 14, 23);
  doc.text(`Order ID: ${order.id}`, pageWidth - 46, 23, { align: "right" });

  let y = 40;
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  doc.text("ORDER INFORMATION", 14, y);
  y += 6;
  doc.setLineWidth(0.3);
  doc.setDrawColor(203, 213, 225);
  doc.line(14, y, pageWidth - 14, y);
  y += 8;

  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text("Studio:", 14, y); doc.setFont("helvetica", "normal"); doc.text(studio?.name || "N/A", 48, y);
  y += 7;
  doc.setFont("helvetica", "bold"); doc.text("Product:", 14, y); doc.setFont("helvetica", "normal"); doc.text(product?.name || "Custom Print", 48, y);
  y += 7;
  doc.setFont("helvetica", "bold"); doc.text("Size:", 14, y); doc.setFont("helvetica", "normal"); doc.text(product?.size || "N/A", 48, y);
  y += 7;
  doc.setFont("helvetica", "bold"); doc.text("Quantity:", 14, y); doc.setFont("helvetica", "normal"); doc.text(String(order.quantity), 48, y);
  y += 7;
  doc.setFont("helvetica", "bold"); doc.text("Order Status:", 14, y); doc.setFont("helvetica", "normal"); doc.text(order.status, 48, y);
  y += 7;
  doc.setFont("helvetica", "bold"); doc.text("Payment Status:", 14, y); doc.setFont("helvetica", "normal"); doc.text(order.paymentStatus, 48, y);
  y += 7;
  doc.setFont("helvetica", "bold"); doc.text("Payment Method:", 14, y); doc.setFont("helvetica", "normal"); doc.text(order.paymentMethod || "Cash (Pay on Pickup)", 48, y);
  y += 7;
  doc.setFont("helvetica", "bold"); doc.text("Reference No:", 14, y); doc.setFont("helvetica", "normal"); doc.text(order.referenceNumber || "N/A", 48, y);
  y += 7;
  doc.setFont("helvetica", "bold"); doc.text("Order Date:", 14, y); doc.setFont("helvetica", "normal"); doc.text(new Date(order.createdAt).toLocaleString(), 48, y);
  y += 7;

  doc.setFont("helvetica", "bold"); doc.text("Pickup:", 14, y); doc.setFont("helvetica", "normal"); doc.text("Studio pickup", 48, y);
 
  y += 16;
  doc.setFillColor(248, 250, 252);
  doc.rect(14, y, pageWidth - 28, 24, "F");
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("TOTAL AMOUNT", 18, y + 8);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(`PHP ${order.totalAmount.toLocaleString()}`, pageWidth - 18, y + 8, { align: "right" });
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text(`Paid via ${order.paymentMethod || "Cash"} \u2022 ${order.paymentStatus}`, 18, y + 18);

  y += 36;
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(8);
  doc.text("Thank you for ordering with Cainta Photography Studio. Your artwork will be processed and updated in the order tracker.", 14, y, { maxWidth: pageWidth - 28 });

  return doc;
}

export function generatePrintOrderReceiptPDF(
  order: PrintOrder,
  studio?: Studio,
  product?: { name?: string; size?: string; description?: string; price?: number }
) {
  const doc = buildPrintOrderReceiptPDF(order, studio, product);
  doc.save(`Print_Order_${order.id}_Receipt.pdf`);
}

/**
 * Generates a Studio Financial & Sales Analytics PDF Report
 */
export function generateStudioSalesReportPDF(
  studio: Studio,
  bookings: Booking[],
  printOrders: PrintOrder[],
  dateRangeLabel: string = "All-Time Financial Ledger"
) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const activeBookings = bookings.filter(booking => booking.status !== "Cancelled" && booking.status !== "Rejected");
  const activePrintOrders = printOrders.filter(order => order.status !== "Cancelled");

  const reportTitleLines = doc.splitTextToSize(`${studio.name.toUpperCase()} - FINANCIAL REPORT`, pageWidth - 28);
  const scopeLines = doc.splitTextToSize(`Scope: ${dateRangeLabel} | Generated on: ${new Date().toLocaleString()}`, pageWidth - 28);
  const locationLines = doc.splitTextToSize(`Studio Location: ${studio.address || "—"}`, pageWidth - 28);
  const headerHeight = Math.max(38, 10 + reportTitleLines.length * 6 + scopeLines.length * 4 + locationLines.length * 4);
  doc.setFillColor(15, 23, 42); // Slate 900
  doc.rect(0, 0, pageWidth, headerHeight, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(reportTitleLines, 14, 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const headerTextY = 12 + reportTitleLines.length * 6;
  doc.text(scopeLines, 14, headerTextY);
  doc.text(locationLines, 14, headerTextY + scopeLines.length * 4);

  let y = headerHeight + 10;
  const totalBookingRevenue = activeBookings.reduce((sum, booking) => sum + Number(booking.amountPaid || 0), 0);
  const totalPrintRevenue = activePrintOrders.filter(order => order.paymentStatus === "Paid")
    .reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
  const totalRevenue = totalBookingRevenue + totalPrintRevenue;

  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, y, 55, 20, 2, 2, "F");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("TOTAL REVENUE", 18, y + 6);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(`PHP ${totalRevenue.toLocaleString()}`, 18, y + 14);

  doc.setFillColor(248, 250, 252);
  doc.roundedRect(75, y, 55, 20, 2, 2, "F");
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text("ACTIVE BOOKINGS", 79, y + 6);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(`${activeBookings.length} Records`, 79, y + 14);

  doc.setFillColor(248, 250, 252);
  doc.roundedRect(136, y, 55, 20, 2, 2, "F");
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text("PRINTING ORDERS", 140, y + 6);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(`${activePrintOrders.length} Orders`, 140, y + 14);

  y += 30;

  const drawTableHeader = (title: string, headers: string[], widths: number[], continued = false) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(continued ? `${title} (continued)` : title, margin, y);
    y += 6;
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y, pageWidth - margin * 2, 8, "F");
    doc.setFontSize(7);
    doc.setTextColor(51, 65, 85);
    let x = margin + 2;
    headers.forEach((header, index) => {
      doc.text(header, x, y + 5.5);
      x += widths[index];
    });
    y += 10;
  };

  const drawRows = (title: string, headers: string[], widths: number[], rows: string[][]) => {
    drawTableHeader(title, headers, widths);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(15, 23, 42);

    if (rows.length === 0) {
      doc.setTextColor(100, 116, 139);
      doc.text("No records available.", margin + 2, y + 4);
      y += 10;
      return;
    }

    rows.forEach(row => {
      const cellLines = row.map((value, index) =>
        doc.splitTextToSize(String(value || "—"), widths[index] - 4)
      );
      const maxCellLineCount = Math.max(...cellLines.map(lines => lines.length));
      let lineOffset = 0;

      while (lineOffset < maxCellLineCount) {
        const availableLines = Math.floor((pageHeight - 18 - y - 4) / 3.6);
        if (availableLines < 1) {
          doc.addPage();
          y = 18;
          drawTableHeader(title, headers, widths, true);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(7);
          doc.setTextColor(15, 23, 42);
          continue;
        }

        const lineCount = Math.min(maxCellLineCount - lineOffset, availableLines);
        let x = margin + 2;
        cellLines.forEach((lines, index) => {
          const visibleLines = lines.slice(lineOffset, lineOffset + lineCount);
          if (visibleLines.length > 0) {
            doc.text(visibleLines, x, y + 4);
          }
          x += widths[index];
        });

        y += Math.max(8, lineCount * 3.6 + 4);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.2);
        doc.line(margin, y, pageWidth - margin, y);
        lineOffset += lineCount;
      }
    });
    y += 10;
  };

  const tableWidths = [30, 46, 52, 24, 30];
  drawRows("Bookings Revenue Ledger", ["Booking ID", "Customer / Contact", "Schedule / Service / Add-ons", "Status / Payment", "Paid / Balance / Total"], tableWidths,
    bookings.map(booking => {
      const details = booking as Booking & {
        serviceName?: string;
        packageName?: string;
        addonReportDetails?: string;
        paymentMethods?: string;
        paymentReferences?: string;
      };
      const balance = Number(booking.remainingBalance ?? Math.max(Number(booking.totalAmount || 0) - Number(booking.amountPaid || 0), 0));
      return [
      booking.id,
      `${booking.customerDetails?.fullName || "—"}\n${booking.customerDetails?.email || "—"}\n${booking.customerDetails?.phone || "—"}`,
      `${booking.bookingDate || "—"} ${booking.timeSlot || ""}\nService: ${details.serviceName || booking.serviceId || "—"}\nPackage: ${details.packageName || booking.packageId || "—"}\nAdd-ons: ${details.addonReportDetails || "None"}`,
      `${booking.status}\n${booking.paymentStatus || "Unpaid"}\n${details.paymentMethods || booking.paymentOption || "—"}\nRef: ${details.paymentReferences || "—"}`,
      `Paid: PHP ${Number(booking.amountPaid || 0).toLocaleString()}\nBalance: PHP ${balance.toLocaleString()}\nTotal: PHP ${Number(booking.totalAmount || 0).toLocaleString()}`,
      ];
    }));

  drawRows("Print Orders Ledger", ["Order ID", "Customer / ID", "Product / Design / Cash Details", "Status / Payment", "Paid / Balance / Total"], tableWidths,
    printOrders.map(order => {
      const details = order as PrintOrder & { productName?: string; productSize?: string };
      const paidAmount = order.paymentStatus === "Paid" ? Number(order.totalAmount || 0) : 0;
      const balance = Math.max(Number(order.totalAmount || 0) - paidAmount, 0);
      const printDesign = order.printDesign
        ? Object.entries(order.printDesign).map(([key, value]) => `${key}: ${value}`).join(", ")
        : "Standard design";
      return [
        order.id,
        `${(order as any).customerName || order.customerId || "Walk-in"}\nCustomer ID: ${order.customerId || "—"}`,
        `Product: ${details.productName || order.productId || "Photo Print"} (${details.productSize || "—"})\nQty: ${order.quantity}\nDesign: ${printDesign}\nOrdered: ${order.createdAt ? new Date(order.createdAt).toLocaleString() : "—"}\nPaid: ${order.paidAt ? new Date(order.paidAt).toLocaleString() : "—"}\nCash received by: ${order.cashReceivedBy || "—"}\nTendered: PHP ${Number(order.cashTendered || 0).toLocaleString()} | Change: PHP ${Number(order.changeAmount || 0).toLocaleString()}`,
        `${order.status}\n${order.paymentStatus}\n${order.paymentMethod || "Cash"}\nRef: ${order.referenceNumber || "—"}`,
        `Paid: PHP ${paidAmount.toLocaleString()}\nBalance: PHP ${balance.toLocaleString()}\nTotal: PHP ${Number(order.totalAmount || 0).toLocaleString()}`,
      ];
    }));

  if (y + 20 > pageHeight - 14) {
    doc.addPage();
    y = 24;
  }
  doc.setLineWidth(0.3);
  doc.setDrawColor(203, 213, 225);
  doc.line(14, y, 70, y);
  doc.line(pageWidth - 70, y, pageWidth - 14, y);
  y += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("Prepared By: Studio Administrator", 14, y);
  doc.text("Approved By: Cainta MIS Super Admin", pageWidth - 70, y);

  doc.save(`${studio.name.replace(/[^a-z0-9]/gi, "_")}_Financial_Report.pdf`);
}
