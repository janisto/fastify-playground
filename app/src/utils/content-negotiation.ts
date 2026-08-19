export const CBOR_MEDIA_TYPE = "application/cbor";
export const JSON_MEDIA_TYPE = "application/json";
export const PROBLEM_JSON_MEDIA_TYPE = "application/problem+json";
export const SCHEMA_JSON_MEDIA_TYPE = "application/schema+json";
export const API_MEDIA_TYPES = [JSON_MEDIA_TYPE, CBOR_MEDIA_TYPE] as const;

const QVALUE_PATTERN = /^(?:0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/;
const HTTP_TOKEN_PATTERN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;

export function normalizeMediaType(mediaType: string): string {
  return mediaType.split(";", 1)[0]?.trim().toLowerCase() ?? "";
}

function isJsonMediaType(mediaType: string): boolean {
  const subtype = mediaType.split("/").at(1);
  return subtype === "json" || subtype?.endsWith("+json") === true;
}

function splitOutsideQuotes(value: string, delimiter: string): string[] | null {
  const result: string[] = [];
  let start = 0;
  let quoted = false;
  let escaped = false;
  for (let index = 0; index < value.length; index += 1) {
    const character = value.at(index);
    if (quoted) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') quoted = false;
    } else if (character === '"') {
      quoted = true;
    } else if (character === delimiter) {
      result.push(value.slice(start, index));
      start = index + 1;
    }
  }
  if (quoted || escaped) return null;
  result.push(value.slice(start));
  return result;
}

function closingQuoteIndex(value: string, start: number): number {
  let escaped = false;
  for (let index = start; index < value.length; index += 1) {
    const character = value.at(index);
    if (escaped) escaped = false;
    else if (character === "\\") escaped = true;
    else if (character === '"') return index;
  }
  return -1;
}

function splitAcceptRanges(value: string): string[] {
  const result: string[] = [];
  let start = 0;
  for (let index = 0; index < value.length; index += 1) {
    const character = value.at(index);
    if (character === '"') {
      const closing = closingQuoteIndex(value, index + 1);
      if (closing >= 0) index = closing;
    } else if (character === ",") {
      result.push(value.slice(start, index));
      start = index + 1;
    }
  }
  result.push(value.slice(start));
  return result;
}

function decodeParameterValue(value: string): string | null {
  const trimmed = value.trim();
  if (HTTP_TOKEN_PATTERN.test(trimmed)) return trimmed;
  if (!trimmed.startsWith('"') || !trimmed.endsWith('"') || trimmed.length < 2) return null;

  let decoded = "";
  for (let index = 1; index < trimmed.length - 1; index += 1) {
    const code = trimmed.charCodeAt(index);
    if (code === 0x5c) {
      index += 1;
      if (index >= trimmed.length - 1) return null;
      const escaped = trimmed.charCodeAt(index);
      if (escaped !== 0x09 && (escaped < 0x20 || escaped === 0x7f)) return null;
      decoded += trimmed[index];
    } else {
      if (code === 0x22 || (code !== 0x09 && (code < 0x20 || code === 0x7f))) return null;
      decoded += trimmed[index];
    }
  }
  return decoded;
}

interface ParsedParameters {
  mediaParameterCount: number;
  quality: number;
}

function parseParameters(parameters: readonly string[], target: string): ParsedParameters | null {
  let quality = 1;
  let qualitySeen = false;
  const mediaParameters = new Set<string>();

  for (const rawParameter of parameters) {
    const parameter = rawParameter.trim();
    if (!parameter) return null;
    const separator = parameter.indexOf("=");
    const name = (separator < 0 ? parameter : parameter.slice(0, separator)).trim().toLowerCase();
    if (!HTTP_TOKEN_PATTERN.test(name)) return null;
    const rawValue = separator < 0 ? "" : parameter.slice(separator + 1).trim();

    if (name === "q") {
      if (qualitySeen) return null;
      if (separator <= 0 || !QVALUE_PATTERN.test(rawValue)) return null;
      quality = Number(rawValue);
      qualitySeen = true;
      continue;
    }
    if (qualitySeen) {
      if (separator >= 0 && decodeParameterValue(rawValue) === null) return null;
      continue;
    }

    const value = separator <= 0 ? null : decodeParameterValue(rawValue);
    if (
      value === null ||
      name !== "charset" ||
      !isJsonMediaType(target) ||
      value.toLowerCase() !== "utf-8" ||
      mediaParameters.has(name)
    ) {
      return null;
    }
    mediaParameters.add(name);
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

function matchMediaRange(
  rawItem: string,
  target: string,
  explicitOnly: boolean,
  withUtf8Charset: boolean,
): MediaRangeMatch | null {
  const item = rawItem.trim();
  if (!item) return null;

  const parts = splitOutsideQuotes(item, ";");
  if (parts === null) return null;
  const [rawRange, ...parameters] = parts;
  const range = normalizeMediaType(rawRange ?? "");
  const parsedParameters = parseParameters(parameters, target);
  if (parsedParameters === null || !range.includes("/")) return null;
  if (!withUtf8Charset && parsedParameters.mediaParameterCount > 0) return null;

  const specificity = rangeSpecificity(range, target);
  if (specificity === null || (explicitOnly && specificity < 2)) return null;
  return { ...parsedParameters, specificity };
}

function mediaTypeQuality(
  acceptHeader: string,
  mediaType: string,
  explicitOnly = false,
  withUtf8Charset = false,
): number | null {
  if (!acceptHeader) return null;

  const target = normalizeMediaType(mediaType);
  let bestMediaParameterCount = -1;
  let bestSpecificity = -1;
  let bestQuality = 0;

  for (const rawItem of splitAcceptRanges(acceptHeader)) {
    const match = matchMediaRange(rawItem, target, explicitOnly, withUtf8Charset);
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
  const baseQuality = mediaTypeQuality(acceptHeader, mediaType, explicitOnly);
  const utf8Quality = isJsonMediaType(normalizeMediaType(mediaType))
    ? mediaTypeQuality(acceptHeader, mediaType, explicitOnly, true)
    : null;
  return (baseQuality !== null && baseQuality > 0) || (utf8Quality !== null && utf8Quality > 0);
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
    const forms = isJsonMediaType(normalizeMediaType(mediaType)) ? [false, true] : [false];
    for (const withUtf8Charset of forms) {
      const quality = mediaTypeQuality(acceptHeader, mediaType, explicitOnly.has(mediaType), withUtf8Charset);
      if (quality !== null && quality > selectedQuality) {
        selected = withUtf8Charset ? `${normalizeMediaType(mediaType)}; charset=utf-8` : mediaType;
        selectedQuality = quality;
      }
    }
  }

  return selected;
}

export function negotiateApiMediaType(acceptHeader: string, allowCbor = true): string | null {
  const available = allowCbor ? API_MEDIA_TYPES : [JSON_MEDIA_TYPE];
  return negotiateMediaType(acceptHeader, available, new Set(allowCbor ? [CBOR_MEDIA_TYPE] : []));
}

export function negotiateProblemMediaType(acceptHeader: string): string {
  const baseJsonQuality =
    mediaTypeQuality(acceptHeader, PROBLEM_JSON_MEDIA_TYPE, true) ??
    mediaTypeQuality(acceptHeader, PROBLEM_JSON_MEDIA_TYPE) ??
    0;
  const utf8JsonQuality =
    mediaTypeQuality(acceptHeader, PROBLEM_JSON_MEDIA_TYPE, true, true) ??
    mediaTypeQuality(acceptHeader, PROBLEM_JSON_MEDIA_TYPE, false, true) ??
    0;
  const cborQuality = mediaTypeQuality(acceptHeader, CBOR_MEDIA_TYPE, true) ?? 0;
  const jsonQuality = Math.max(baseJsonQuality, utf8JsonQuality);

  if (cborQuality > jsonQuality) return CBOR_MEDIA_TYPE;
  return utf8JsonQuality > baseJsonQuality ? `${PROBLEM_JSON_MEDIA_TYPE}; charset=utf-8` : PROBLEM_JSON_MEDIA_TYPE;
}

export function contentTypeMatches(contentType: string, mediaType: string): boolean {
  return normalizeMediaType(contentType) === normalizeMediaType(mediaType);
}
