<?php

namespace App\Services;

/** An original, tiny synthetic PDF; contains no third-party book content. */
class SamplePdf
{
    public static function bytes(): string
    {
        $text = 'BT /F1 26 Tf 60 740 Td (ReadDuniya) Tj 0 -50 Td /F1 18 Tf (A New Beginning) Tj 0 -50 Td /F1 12 Tf (Every open page is a small beginning.) Tj 0 -24 Td (Today, a reader follows a little curiosity.) Tj 0 -24 Td (Tomorrow, a whole new world is waiting.) Tj 0 -60 Td (Synthetic sample written for this project. Not a full book.) Tj ET';
        $objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', '<< /Length '.strlen($text)." >>\nstream\n".$text."\nendstream"];
        $pdf = "%PDF-1.4\n";
        $offsets = [0];
        foreach ($objects as $i => $o) {
            $offsets[] = strlen($pdf);
            $pdf .= ($i + 1)." 0 obj\n".$o."\nendobj\n";
        }
        $start = strlen($pdf);
        $pdf .= "xref\n0 6\n0000000000 65535 f \n";
        foreach (array_slice($offsets, 1) as $offset) {
            $pdf .= sprintf("%010d 00000 n \n", $offset);
        }

        return $pdf."trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n".$start."\n%%EOF\n";
    }
}
