export function sections(text) {
  const result = [];
  let current = {level: 0, title: "", lines: []};
  for ( const line of text.split(/\r?\n/) ) {
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if ( heading ) {
      result.push(current);
      current = {level: heading[1].length, title: heading[2].trim(), lines: []};
    }
    else current.lines.push(line);
  }
  result.push(current);
  return result;
}

export function tables(lines) {
  const result = [];
  let table = null;
  const cells = line => line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map(cell => cell.trim());
  for ( const line of lines ) {
    if ( !line.trim().startsWith("|") ) { table = null; continue; }
    const row = cells(line);
    if ( !table ) {
      table = {headers: row, rows: []};
      result.push(table);
    }
    else if ( row.every(cell => /^:?-+:?$/.test(cell)) ) continue;
    else table.rows.push(row);
  }
  return result;
}

export function findSection(allSections, prefix, from = 0) {
  for ( let i = from; i < allSections.length; i++ ) {
    if ( allSections[i].title.toLowerCase().startsWith(prefix.toLowerCase()) ) return {section: allSections[i], index: i};
  }
  return null;
}

export function rowObject(headers, row) {
  return Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""]));
}
