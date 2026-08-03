export const CBOR_MEDIA_TYPE = "application/cbor";
export const JSON_MEDIA_TYPE = "application/json";
export const PROBLEM_JSON_MEDIA_TYPE = "application/problem+json";
export const SCHEMA_JSON_MEDIA_TYPE = "application/schema+json";
export const API_MEDIA_TYPES = [JSON_MEDIA_TYPE, CBOR_MEDIA_TYPE] as const;

const QVALUE_PATTERN = /^(?:0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/;

export function normalizeMediaType(mediaType: string): string {
  return mediaType.split(";", 1)[0]?.trim().toLowerCase() ?? "";
}

function isJsonMediaType(mediaType: string): boolean {
  const subtype = mediaType.split("/").at(1);
  return subtype === "json" || subtype?.endsWith("+json") === true;
}

function normalizeParameterValue(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

interface ParsedParameters {
  mediaParameterCount: number;
  quality: number;
}

type ParsedParameter = { kind: "media"; name: string } | { kind: "quality"; value: number };

function parseParameter(parameter: string, target: string): ParsedParameter | null {
  const separator = parameter.indexOf("=");
  if (separator <= 0) return null;

  const name = parameter.slice(0, separator).trim().toLowerCase();
  const value = parameter.slice(separator + 1).trim();
  if (name === "q") {
    return QVALUE_PATTERN.test(value) ? { kind: "quality", value: Number(value) } : null;
  }
  if (name === "charset" && isJsonMediaType(target) && normalizeParameterValue(value).toLowerCase() === "utf-8") {
    return { kind: "media", name };
  }
  return null;
}

function parseParameters(parameters: readonly string[], target: string): ParsedParameters | null {
  let quality = 1;
  let qualitySeen = false;
  const mediaParameters = new Set<string>();

  for (const rawParameter of parameters) {
    const parameter = rawParameter.trim();
    if (!parameter) continue;

    const parsed = parseParameter(parameter, target);
    if (!parsed) return null;
    if (parsed.kind === "quality") {
      if (qualitySeen) return null;
      quality = parsed.value;
      qualitySeen = true;
      continue;
    }

    if (mediaParameters.has(parsed.name)) return null;
    mediaParameters.add(parsed.name);
  }

  return { mediaParameterCount: mediaParameters.size, quality };
}

function rangeSpecificity(range: string, target: string): number | null {
  if (range === target) return 2;
  if (range === "*/*") return 0;

  const [rangeType, rangeSubtype, extraRangePart] = range.split("/");
  const [targetType] = target.split("/");
  if (!extraRangePart && rangeSubtype === "*" && rangeType === targetType) return 1;
  return null;
}

interface MediaRangeMatch {
  mediaParameterCount: number;
  quality: number;
  specificity: number;
}

function matchMediaRange(rawItem: string, target: string, explicitOnly: boolean): MediaRangeMatch | null {
  const item = rawItem.trim();
  if (!item) return null;

  const [rawRange, ...parameters] = item.split(";");
  const range = normalizeMediaType(rawRange ?? "");
  const parsedParameters = parseParameters(parameters, target);
  if (parsedParameters === null || !range.includes("/")) return null;

  const specificity = rangeSpecificity(range, target);
  if (specificity === null || (explicitOnly && specificity < 2)) return null;
  return { ...parsedParameters, specificity };
}

function mediaTypeQuality(acceptHeader: string, mediaType: string, explicitOnly = false): number | null {
  if (!acceptHeader) return null;

  const target = normalizeMediaType(mediaType);
  let bestMediaParameterCount = -1;
  let bestSpecificity = -1;
  let bestQuality = 0;

  for (const rawItem of acceptHeader.split(",")) {
    const match = matchMediaRange(rawItem, target, explicitOnly);
    if (!match) continue;

    if (
      match.specificity > bestSpecificity ||
      (match.specificity === bestSpecificity && match.mediaParameterCount > bestMediaParameterCount)
    ) {
      bestSpecificity = match.specificity;
      bestMediaParameterCount = match.mediaParameterCount;
      bestQuality = match.quality;
    } else if (match.specificity === bestSpecificity && match.mediaParameterCount === bestMediaParameterCount) {
      bestQuality = Math.max(bestQuality, match.quality);
    }
  }

  return bestSpecificity >= 0 ? bestQuality : null;
}

export function acceptsMediaType(acceptHeader: string, mediaType: string, explicitOnly = false): boolean {
  const quality = mediaTypeQuality(acceptHeader, mediaType, explicitOnly);
  return quality !== null && quality > 0;
}

export function negotiateMediaType(
  acceptHeader: string,
  available: readonly string[],
  explicitOnly: ReadonlySet<string> = new Set(),
): string | null {
  const [defaultMediaType] = available;
  if (!defaultMediaType) return null;
  if (!acceptHeader) return defaultMediaType;

  let selected: string | null = null;
  let selectedQuality = 0;

  for (const mediaType of available) {
    const quality = mediaTypeQuality(acceptHeader, mediaType, explicitOnly.has(mediaType));
    if (quality !== null && quality > selectedQuality) {
      selected = mediaType;
      selectedQuality = quality;
    }
  }

  return selected;
}

export function negotiateApiMediaType(acceptHeader: string, allowCbor = true): string | null {
  const available = allowCbor ? API_MEDIA_TYPES : [JSON_MEDIA_TYPE];
  return negotiateMediaType(acceptHeader, available, new Set(allowCbor ? [CBOR_MEDIA_TYPE] : []));
}

export function negotiateProblemMediaType(acceptHeader: string): string {
  const explicitProblemJsonQuality = mediaTypeQuality(acceptHeader, PROBLEM_JSON_MEDIA_TYPE, true);
  const jsonQuality = explicitProblemJsonQuality ?? mediaTypeQuality(acceptHeader, PROBLEM_JSON_MEDIA_TYPE) ?? 0;
  const cborQuality = mediaTypeQuality(acceptHeader, CBOR_MEDIA_TYPE, true) ?? 0;

  return cborQuality > jsonQuality ? CBOR_MEDIA_TYPE : PROBLEM_JSON_MEDIA_TYPE;
}

export function contentTypeMatches(contentType: string, mediaType: string): boolean {
  return normalizeMediaType(contentType) === normalizeMediaType(mediaType);
}
