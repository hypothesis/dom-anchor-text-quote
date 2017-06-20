import search from 'approx-string-match'
import * as textPosition from 'dom-anchor-text-position'

const CONTEXT_LENGTH = 32

export function fromRange(root, range) {
  if (root === undefined) {
    throw new Error('missing required parameter "root"')
  }
  if (range === undefined) {
    throw new Error('missing required parameter "range"')
  }

  let position = textPosition.fromRange(root, range)
  return fromTextPosition(root, position)
}


export function fromTextPosition(root, selector) {
  if (root === undefined) {
    throw new Error('missing required parameter "root"')
  }
  if (selector === undefined) {
    throw new Error('missing required parameter "selector"')
  }

  let {start} = selector
  if (start === undefined) {
    throw new Error('selector missing required property "start"')
  }
  if (start < 0) {
    throw new Error('property "start" must be a non-negative integer')
  }

  let {end} = selector
  if (end === undefined) {
    throw new Error('selector missing required property "end"')
  }
  if (end < 0) {
    throw new Error('property "end" must be a non-negative integer')
  }

  let exact = root.textContent.substr(start, end - start)

  let prefixStart = Math.max(0, start - CONTEXT_LENGTH)
  let prefix = root.textContent.substr(prefixStart, start - prefixStart)

  let suffixEnd = Math.min(root.textContent.length, end + CONTEXT_LENGTH)
  let suffix = root.textContent.substr(end, suffixEnd - end)

  return {exact, prefix, suffix}
}


export function toRange(root, selector, options = {}) {
  let position = toTextPosition(root, selector, options)
  if (position === null) {
    return null
  } else {
    return textPosition.toRange(root, position)
  }
}


export function toTextPosition(root, selector, options = {}) { // eslint-disable-line no-unused-vars
  if (root === undefined) {
    throw new Error('missing required parameter "root"')
  }
  if (selector === undefined) {
    throw new Error('missing required parameter "selector"')
  }

  let {exact} = selector
  if (exact === undefined) {
    throw new Error('selector missing required property "exact"')
  }

  let {prefix, suffix} = selector
  let textContent = root.textContent

  let maxErrors = Math.floor(exact.length / 10)

  // Fast path for exact matches.
  let wholeTarget = prefix + exact + suffix
  let wholeTargetIdx = textContent.indexOf(wholeTarget)
  if (wholeTargetIdx !== -1) {
    return {
      start: wholeTargetIdx + prefix.length,
      end: wholeTargetIdx + prefix.length + exact.length,
    }
  }

  let matches = search(textContent, exact, maxErrors)
  if (matches.length === 0) {
    // No match 😞
    return null
  }

  // Score a match based on the number of errors in the quote match and whether
  // prefix and suffix matches were found.
  let score = match => {
    let matchScore = match.errors
    let prefixLen = prefix ? prefix.length : 0
    let suffixLen = suffix ? suffix.length : 0
    let textSection = textContent.slice(match.start - prefixLen - maxErrors,
                                        match.end + suffixLen + maxErrors)

    if (prefix) {
      let prefixMatch = search(textSection, prefix, maxErrors).length > 0
      if (prefixMatch) {
        matchScore += 1
      }
    }

    if (suffix) {
      let suffixMatch = search(textSection, suffix, maxErrors).length > 0
      if (suffixMatch) {
        matchScore += 1
      }
    }

    return matchScore
  }

  // Sort matches by score.
  matches.sort((a, b) => {
    let scoreA = score(a)
    let scoreB = score(b)

    if (scoreA !== scoreB) {
      return scoreB - scoreA
    }

    // If matches have the same score, order by proximity to expected location
    // (options.hint).

    if (!options.hint) {
      return 0
    }

    let distA = Math.abs(a.start - options.hint);
    let distB = Math.abs(b.start - options.hint);

    return distA - distB;
  });

  return matches[0]
}
