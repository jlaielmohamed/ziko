$s = Get-Content 'C:\ziko\ziko-update\public\script.js' -Raw
$i = $s.IndexOf('async function loadSlots')
if($i -ge 0) {
  $end = $s.IndexOf("document.getElementById('d')", $i)
  if($end -lt 0) { $end = $s.IndexOf("d.min", $i) }
  if($end -lt 0) { $end = $i + 800 }
  $substr = $s.Substring($i, $end-$i)
  $substr | Out-File -FilePath 'C:\ziko\ziko-update\loadslots_out.txt' -Encoding UTF8
  Write-Host "done"
} else {
  Write-Host "not found"
}
