export function groupCountyOfficeholders<Person extends { officeType?: string | null }>(people: Person[], vacancies?: string[]) {
	if (vacancies === undefined) return [{ id: "representatives", label: "", people, vacancies: [] as string[] }];
	const groups = [
		{ id: "commission", label: "County commission", people: people.filter(person => person.officeType === "county_commission"), vacancies: vacancies.filter(office => office.startsWith("County Commission")) },
		{ id: "offices", label: "County offices", people: people.filter(person => person.officeType !== "county_commission"), vacancies: vacancies.filter(office => !office.startsWith("County Commission")) }
	].filter(group => group.people.length || group.vacancies.length);
	return groups.length === 1 ? groups.map(group => ({ ...group, label: "" })) : groups;
}
