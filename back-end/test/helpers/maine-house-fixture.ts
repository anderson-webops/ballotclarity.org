export function maineHouseFixture(legislature = 133) {
	const suffix = legislature % 100 >= 11 && legislature % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[legislature % 10] ?? "th";
	const candidate = (name: string, party: string, code: string, incumbent = false) => `<li class="list-group-item"><div><div><h6>${incumbent ? "<i class='fa-star' title='Incumbent' aria-hidden='true'></i>" : ""}<strong>${name}</strong><span>${code}</span></h6><p><i aria-hidden="true"></i>Example Town</p></div><div class="text-end"><span>${party}</span></div></div></li>`;
	const districts = Array.from({ length: 151 }, (_, index) => {
		const candidates = index === 0 ? candidate("Example, Ada", "Democrat", "D", true) + candidate("Sample, Bert", "Republican", "R") : "";
		return `<div id="district-${index + 1}"><div class="card-header"><h5>District ${index + 1}</h5><span class="badge">${index ? 0 : 2} Candidates</span></div><ul>${candidates}</ul></div>`;
	}).join("");
	return `<html><head><title>Candidate List - Maine House of Representatives</title></head><body><div><div><h3>Candidate List</h3></div><div><h4>${legislature}${suffix} Legislature</h4><p>Last Updated: October 27, 2026 - 7:48 AM</p><div class="alert-info">This list has been compiled from a number of sources and represents the most complete and accurate information we could find. It is unofficial until the results can be checked against the official list from the Office of the Secretary of State. From Robert Hunt, Clerk of the House and Michelle Dunphy, Assistant Clerk of the House</div></div></div><div><h3>2</h3><small>Total Candidates</small></div><div><h3>151</h3><small>Districts</small></div><div><h3>1</h3><small>Incumbents</small></div>${districts}</body></html>`;
}
