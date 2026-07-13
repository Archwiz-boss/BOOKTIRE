param(
    [Parameter(Mandatory = $true)]
    [string]$DatabaseRoot,

    [Parameter(Mandatory = $true)]
    [string]$OutputPath,

    [Parameter(Mandatory = $false)]
    [string]$TaichungSectionsCsv
)

$ErrorActionPreference = 'Stop'

function Open-MdbConnection {
    param([string]$Path)

    $connection = New-Object System.Data.OleDb.OleDbConnection(
        "Provider=Microsoft.Jet.OLEDB.4.0;Data Source=$Path;"
    )
    $connection.Open()
    return $connection
}

function Read-String {
    param(
        [System.Data.OleDb.OleDbDataReader]$Reader,
        [int]$Index
    )
    if ($Reader.IsDBNull($Index)) { return '' }
    return ([string]$Reader.GetValue($Index)).Trim()
}

$bldcodePath = Join-Path $DatabaseRoot 'bldcode.mdb'
$landPath = Join-Path $DatabaseRoot 'land.mdb'
$codeTypes = [ordered]@{}
$codeRowCount = 0

$connection = Open-MdbConnection -Path $bldcodePath
try {
    $command = $connection.CreateCommand()
    $command.CommandText = 'SELECT CODE_TYPE,CODE_SEQ,SUB_SEQ,SUB_SEQ1,CODE_DESC,MARK FROM Bldcode ORDER BY CODE_TYPE,SUB_SEQ1,SUB_SEQ,CODE_SEQ'
    $reader = $command.ExecuteReader()
    try {
        while ($reader.Read()) {
            $type = Read-String -Reader $reader -Index 0
            if (-not $type) { continue }
            if (-not $codeTypes.Contains($type)) {
                $codeTypes[$type] = New-Object System.Collections.ArrayList
            }
            $label = Read-String -Reader $reader -Index 4
            if ($label.Length -ge 2 -and $label.StartsWith("'") -and $label.EndsWith("'")) {
                $label = $label.Substring(1, $label.Length - 2)
            }
            [void]$codeTypes[$type].Add([ordered]@{
                code = Read-String -Reader $reader -Index 1
                sub = Read-String -Reader $reader -Index 2
                parent = Read-String -Reader $reader -Index 3
                label = $label
                mark = Read-String -Reader $reader -Index 5
            })
            $codeRowCount++
        }
    }
    finally {
        $reader.Close()
        $reader.Dispose()
        $command.Dispose()
    }
}
finally {
    $connection.Close()
    $connection.Dispose()
}

$landOldNew = New-Object System.Collections.ArrayList
$connection = Open-MdbConnection -Path $landPath
try {
    $command = $connection.CreateCommand()
    $command.CommandText = 'SELECT DATAID,OLDZON,OLDLAND,NEWZON,NEWLAND FROM LAND_OLD_NEW ORDER BY DATAID'
    $reader = $command.ExecuteReader()
    try {
        while ($reader.Read()) {
            [void]$landOldNew.Add([ordered]@{
                id = Read-String -Reader $reader -Index 0
                oldDistrict = Read-String -Reader $reader -Index 1
                oldSection = Read-String -Reader $reader -Index 2
                newDistrict = Read-String -Reader $reader -Index 3
                newSection = Read-String -Reader $reader -Index 4
            })
        }
    }
    finally {
        $reader.Close()
        $reader.Dispose()
        $command.Dispose()
    }
}
finally {
    $connection.Close()
    $connection.Dispose()
}

$officialSections = New-Object System.Collections.ArrayList
if ($TaichungSectionsCsv) {
    if (-not (Test-Path -LiteralPath $TaichungSectionsCsv)) {
        throw "Taichung land-section CSV not found: $TaichungSectionsCsv"
    }

    $districtCodes = @{}
    foreach ($zone in $codeTypes['ZON']) {
        if ($zone.parent -ne 'I80') { continue }
        $districtName = ([string]$zone.label).Substring(3)
        if ($districtName) { $districtCodes[$districtName] = [string]$zone.code }
    }

    $csvBytes = [System.IO.File]::ReadAllBytes($TaichungSectionsCsv)
    $csvText = [System.Text.Encoding]::UTF8.GetString($csvBytes).TrimStart([char]0xFEFF)
    $csvRows = @($csvText | ConvertFrom-Csv)
    $sectionSuffix = [string][char]0x6BB5
    $subsectionSuffix = ([string][char]0x5C0F) + ([string][char]0x6BB5)
    foreach ($row in $csvRows) {
        $columns = @($row.PSObject.Properties)
        $districtName = ([string]$columns[7].Value).Trim()
        if (-not $districtCodes.ContainsKey($districtName)) {
            throw "Cannot map Taichung district '$districtName' to a legacy ZON code."
        }

        $section = ([string]$columns[1].Value).Trim()
        $subsection = ([string]$columns[2].Value).Trim()
        $sectionCode = ([string]$columns[3].Value).Trim().PadLeft(4, '0')
        $label = if ($section.EndsWith($sectionSuffix)) { $section } else { $section + $sectionSuffix }
        if ($subsection) {
            $label += if ($subsection.EndsWith($subsectionSuffix)) { $subsection } else { $subsection + $subsectionSuffix }
        }

        [void]$officialSections.Add([ordered]@{
            code = $districtCodes[$districtName]
            sub = $sectionCode
            parent = 'I80'
            label = $label
            mark = ''
            source = 'taichung-open-data'
            district = $districtName
            section = $section
            subsection = $subsection
            officeCode = ([string]$columns[5].Value).Trim()
            officeName = ([string]$columns[8].Value).Trim()
        })
    }
}

$source = [ordered]@{
    bldcode = 'cpami/Arch2016C/bldcode.mdb'
    bldcodeRows = $codeRowCount
    codeTypeCount = $codeTypes.Count
    land = 'cpami/Arch2016C/land.mdb'
    landOldNewRows = $landOldNew.Count
}
if ($TaichungSectionsCsv) {
    $source['taichungSections'] = [ordered]@{
        dataset = 'Taichung City land-section code table'
        provider = 'Taichung City Government Land Administration Bureau'
        metadataUpdated = '2026-05-12'
        resource = 'Taichung land-section CSV, dated 2026-05-11'
        url = 'https://data.gov.tw/dataset/84391'
        rows = $officialSections.Count
    }
}

$result = [ordered]@{
    version = 2
    source = $source
    codeTypes = $codeTypes
    officialSections = $officialSections
    landOldNew = $landOldNew
}

$json = $result | ConvertTo-Json -Depth 8 -Compress
$outputDirectory = Split-Path -Parent $OutputPath
if (-not (Test-Path -LiteralPath $outputDirectory)) {
    [void](New-Item -ItemType Directory -Path $outputDirectory)
}
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($OutputPath, $json, $utf8NoBom)

Write-Output ("Exported {0} code rows in {1} types, {2} official sections and {3} land mappings to {4}" -f $codeRowCount, $codeTypes.Count, $officialSections.Count, $landOldNew.Count, $OutputPath)
