function distance(a, b) {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

export function commandTargets(command, snapshot, officer, {chosenId = null} = {}) {
  const units = snapshot?.units ?? [];
  const radius = command?.radius ?? officer?.commandRadius ?? 0;
  const types = command?.companyTypes ?? null;
  const typeOk = unit => !types || types.includes(unit.type);
  const companies = units.filter(unit => (unit.kind === "company") && !unit.defeated && typeOk(unit));
  switch ( command?.target ?? "companiesInRadius" ) {
    case "oneCompany": {
      const inRadius = companies.filter(unit => (unit.side === officer.side) && (distance(unit, officer) <= radius));
      if ( chosenId ) return inRadius.filter(unit => unit.id === chosenId);
      return inRadius.slice(0, 1);
    }
    case "enemyCompaniesWithin":
      return companies.filter(unit => (unit.side !== officer.side) && (distance(unit, officer) <= radius));
    case "companiesInRadius":
    default:
      return companies.filter(unit => (unit.side === officer.side) && (distance(unit, officer) <= radius));
  }
}

export function inAnyRadius(unit, snapshot) {
  for ( const other of snapshot?.units ?? [] ) {
    if ( !other.officer || (other.side !== unit.side) || other.defeated || (other.id === unit.id) ) continue;
    if ( distance(unit, other) <= (other.commandRadius ?? 0) ) return true;
  }
  return false;
}
