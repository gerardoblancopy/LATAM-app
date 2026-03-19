const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, 'public', 'chart_helper.js');
let content = fs.readFileSync(targetFile, 'utf8');

// Define the exact HTML block to replace
const tableBlockRegex = /<table class="res-table">\s*<tr style="background:#fefce8;"><td style="font-weight:bold; color:#854d0e;">Ingreso Req Semestre \(IR\):<\/td><td align="right" style="font-weight:bold; color:#854d0e; font-size:1\.1em">\$\{formatCur\(ir\)\}<\/td><\/tr>\s*<tr><td>CARGO POR USO \(P\):<\/td><td align="right; font-weight:bold">\$\{formatCur\(P\)\}<\/td><\/tr>\s*<tr><td>CARGO COMPL\. \(CC\):<\/td><td align="right; font-weight:bold">\$\{formatCur\(CC\)\}<\/td><\/tr>\s*<tr style="background:#fbfccb;"><td style="font-weight:bold;">Total Peaje a Asignar \(P\+CC\):<\/td><td align="right" style="font-weight:bold;">\$\{formatCur\(MR\)\}<\/td><\/tr>\s*<tr><td>MR \(Asig\. a Retiros\):<\/td><td align="right">\$\{formatCur\(MR_allocated\)\}<\/td><\/tr>\s*<tr><td>MI \(Asig\. a Inyecciones\):<\/td><td align="right">\$\{formatCur\(MI_allocated\)\}<\/td><\/tr>\s*<tr style="background:#f8fafc;"><td style="font-weight:bold;">CURTR C \(Costo Unit\. Retiros\)<\/td><td align="right">\$\{formatCur\(conData\.curtrc_imp\)\} \/MWh<\/td><\/tr>\s*<tr style="background:#f8fafc;"><td style="font-weight:bold;">CURTR G \(Costo Unit\. Inyecciones\)<\/td><td align="right">\$\{formatCur\(conData\.curtrg_exp\)\} \/MWh<\/td><\/tr>\s*<tr style="background:#eff6ff;"><td style="font-weight:bold; color:#1d4ed8;">Renta Congestión Total \(Semestral\)<\/td><td align="right; font-weight:bold; color:#1d4ed8;">\$\{formatCur\(CR_CON\)\}<\/td><\/tr>\s*<\/table>/;

const match = content.match(tableBlockRegex);

if (!match) {
    console.log("Could not find the table block.");
} else {
    // Generate the nicely formatted table rows using createTooltipHTML
    const newTableHTML = `
                        <table class="res-table">
                            <tr style="background:#fefce8;"><td style="font-weight:bold; color:#854d0e;">\${createTooltipHTML('Ingreso Req Semestre (IR):', 'Ingreso Requerido Asignable del semestre a reportar, deduciendo otros ingresos y balances de periodos pasados.', '(IAR / 2) + SCF - SCE - CVTn - IVDT')}</td><td align="right" style="font-weight:bold; color:#854d0e; font-size:1.1em">\${formatCur(ir)}</td></tr>
                            <tr><td>\${createTooltipHTML('CARGO POR USO (P):', 'Beneficio o Pago derivado proporcionalmente del uso estricto y útil transmitido por el enlace (Peaje Ex-Post).', 'IR_Semestral * Fracción_De_Uso')}</td><td align="right; font-weight:bold">\${formatCur(P)}</td></tr>
                            <tr><td>\${createTooltipHTML('CARGO COMPL. (CC):', 'Pago por soporte y confiabilidad sistémica para el cubrimiento de la porción de inversión sub-utilizada de la infraestructura.', 'IR_Semestral * (1 - Fracción_De_Uso)')}</td><td align="right; font-weight:bold">\${formatCur(CC)}</td></tr>
                            <tr style="background:#fbfccb;"><td style="font-weight:bold;">\${createTooltipHTML('Total Peaje a Asignar (P+CC):', 'Suma del Cargo por Uso y el Cargo Complementario a ser recaudado entre los agentes.', 'Peaje + Cargo_Complementario')}</td><td align="right" style="font-weight:bold;">\${formatCur(MR)}</td></tr>
                            <tr><td>\${createTooltipHTML('MR (Asig. a Retiros):', 'Monto a Recuperar correspondiente al sector de la Demanda.', 'Total_Peaje * alpha_R')}</td><td align="right">\${formatCur(MR_allocated)}</td></tr>
                            <tr><td>\${createTooltipHTML('MI (Asig. a Inyecciones):', 'Monto a Recuperar correspondiente al sector de Generación.', 'Total_Peaje * alpha_I')}</td><td align="right">\${formatCur(MI_allocated)}</td></tr>
                            <tr style="background:#f8fafc;"><td style="font-weight:bold;">\${createTooltipHTML('CURTR C (Costo Unit. Retiros)', 'Cargo Unitario por Retiros de Transmisión Regional asignado a la Demanda del importador.', 'MR / Demanda_Semestral')}</td><td align="right">\${formatCur(conData.curtrc_imp)} /MWh</td></tr>
                            <tr style="background:#f8fafc;"><td style="font-weight:bold;">\${createTooltipHTML('CURTR G (Costo Unit. Inyecciones)', 'Cargo Unitario por Inyecciones de Transmisión Regional asignado a Generación del exportador.', 'MI / Generacion_Semestral')}</td><td align="right">\${formatCur(conData.curtrg_exp)} /MWh</td></tr>
                            <tr style="background:#eff6ff;"><td style="font-weight:bold; color:#1d4ed8;">\${createTooltipHTML('Renta Congestión Total (Semestral)', 'Dinero recolectado en el periodo debido a la diferencia de los precios y de los flujos de la línea', '|Flujo| * |LMP_Imp - LMP_Exp| * Horas Semestre')}</td><td align="right; font-weight:bold; color:#1d4ed8;">\${formatCur(CR_CON)}</td></tr>
                        </table>`.trim();

    const newContent = content.replace(tableBlockRegex, newTableHTML);

    fs.writeFileSync(targetFile, newContent);
    console.log('Successfully inserted tooltips!');
}
