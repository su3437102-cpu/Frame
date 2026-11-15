$ErrorActionPreference = 'Stop'
$lutBase = 'https://raw.githubusercontent.com/HuiZeng/Image-Adaptive-3DLUT/b491f6df64a588864739a157db271e5c848e1805'
$adaBase = 'https://raw.githubusercontent.com/ImCharlesY/AdaInt/5678851339dff90becb09c3dec41e7214207ccbc'
$files = @{
  'sources/lut-models.py' = "$lutBase/models.py"
  'sources/adaint-model.py' = "$adaBase/adaint/model.py"
  'sources/adaint-demo.jpg' = "$adaBase/resources/a4739.jpg"
  'sources/3DLUT-LICENSE' = "$lutBase/LICENSE"
  'sources/AdaInt-LICENSE' = "$adaBase/LICENSE"
  'weights/luts.pth' = "$lutBase/pretrained_models/sRGB/LUTs.pth"
  'weights/classifier.pth' = "$lutBase/pretrained_models/sRGB/classifier.pth"
  'weights/adaint.pth' = "$adaBase/pretrained/AiLUT-FiveK-sRGB.pth"
}
foreach ($entry in $files.GetEnumerator()) {
  $target = Join-Path $PSScriptRoot $entry.Key
  New-Item -ItemType Directory -Force (Split-Path $target) | Out-Null
  Invoke-WebRequest $entry.Value -OutFile $target
}
Write-Output 'Downloaded pinned upstream source, model weights and license texts.'
