import type { Response } from "express";

export async function generateBackupCodesPDF(codes: string[], res: Response) {
  try {
    // Try to use pdfkit if available
    const PDFDocument = await import("pdfkit").then((m) => m.default).catch(() => null);
    
    if (PDFDocument) {
      // Generate PDF with pdfkit
      const doc = new PDFDocument({ margin: 50 });
      
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "attachment; filename=backup-codes.pdf");
      
      doc.pipe(res);
      
      // Title
      doc.fontSize(20).text("2FA Backup Codes", { align: "center" });
      doc.moveDown();
      
      // Warning message
      doc.fontSize(12).text(
        "Keep these codes in a safe place. Each code can only be used once.",
        { align: "left" }
      );
      doc.moveDown();
      
      // Codes
      doc.fontSize(14).text("Your Backup Codes:", { underline: true });
      doc.moveDown(0.5);
      
      codes.forEach((code, index) => {
        doc.fontSize(12).text(`${index + 1}. ${code}`);
      });
      
      doc.moveDown();
      doc.fontSize(10).text(
        `Generated on: ${new Date().toLocaleString()}`,
        { align: "left", color: "gray" }
      );
      
      doc.end();
    } else {
      // Fallback to plain text
      generateBackupCodesText(codes, res);
    }
  } catch (error) {
    console.error("PDF generation error:", error);
    // Fallback to text on error
    generateBackupCodesText(codes, res);
  }
}

function generateBackupCodesText(codes: string[], res: Response) {
  res.setHeader("Content-Type", "text/plain");
  res.setHeader("Content-Disposition", "attachment; filename=backup-codes.txt");
  
  let content = "2FA Backup Codes\n";
  content += "================\n\n";
  content += "Keep these codes in a safe place. Each code can only be used once.\n\n";
  content += "Your Backup Codes:\n";
  content += "-----------------\n";
  
  codes.forEach((code, index) => {
    content += `${index + 1}. ${code}\n`;
  });
  
  content += `\nGenerated on: ${new Date().toLocaleString()}\n`;
  
  res.send(content);
}
