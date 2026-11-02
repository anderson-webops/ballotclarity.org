import type { AlabamaFontGlyph } from "./state-ballot-alabama-types.js";
import { Buffer } from "node:buffer";
import { alabamaGlyphApprovals } from "./state-ballot-alabama-glyphs.js";
import { alabamaHash } from "./state-ballot-alabama-types.js";
import { chicagoFontProgram, validateChicagoFontProgram } from "./state-ballot-chicago-fonts.js";

export function createAlabamaFontVerifier(program: Buffer) {
	const envelope = chicagoFontProgram(program, new Map(), "nyc");
	validateChicagoFontProgram(envelope, alabamaGlyphApprovals);
	const verified = new Map<string, string>();
	return (
		information: AlabamaFontGlyph
	): {
		signature: string;
		fontProven: true;
	} => {
		const { unicode, glyph } = information;
		if (
			!Number.isSafeInteger(unicode)
			|| unicode < 32
			|| unicode > 65535
			|| !Number.isSafeInteger(glyph)
			|| glyph <= 0
			|| information.character !== String.fromCodePoint(unicode)
			|| !Buffer.isBuffer(information.outline)
		) {
			throw new Error("The Alabama glyph identity is invalid.");
		}
		const key = `${unicode}:${glyph}`;
		if (!verified.has(key)) {
			const proof = chicagoFontProgram(program, new Map([[glyph, unicode.toString(16).padStart(4, "0")]]), "nyc");
			try {
				validateChicagoFontProgram(proof, alabamaGlyphApprovals);
			}
			catch (error) {
				throw new Error(
					`The Alabama glyph U+${unicode.toString(16)} requires review in ${envelope.signature}.`,
					{ cause: error }
				);
			}
			if (proof.characters[0].sha256 !== alabamaHash(information.outline))
				throw new Error("The Alabama native outline disagrees with its independent font parser.");
			verified.set(key, proof.characters[0].sha256);
		}
		if (verified.get(key) !== alabamaHash(information.outline))
			throw new Error("The Alabama native outline changed after verification.");
		return { signature: envelope.signature, fontProven: true };
	};
}
