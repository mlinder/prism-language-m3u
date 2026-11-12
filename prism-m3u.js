/* global Prism */

// Mirrors the tree-sitter-m3u grammar and its highlight query
// (https://github.com/mlinder/tree-sitter-m3u): tags and attribute names
// the specifications don't define stay plain, so typos stand out.
(function (Prism) {
  var knownTag =
    "#(?:EXT-X-(?:BITRATE|BYTERANGE|CONTENT-STEERING|DATERANGE|DEFINE|" +
    "DISCONTINUITY|DISCONTINUITY-SEQUENCE|ENDLIST|GAP|I-FRAME-STREAM-INF|" +
    "I-FRAMES-ONLY|INDEPENDENT-SEGMENTS|KEY|MAP|MEDIA|MEDIA-SEQUENCE|PART|" +
    "PART-INF|PLAYLIST-TYPE|PRELOAD-HINT|PROGRAM-DATE-TIME|RENDITION-REPORT|" +
    "SERVER-CONTROL|SESSION-DATA|SESSION-KEY|SKIP|START|STREAM-INF|" +
    "TARGETDURATION|VERSION|ALLOW-CACHE)|" +
    "EXTALB|EXTALBUMARTURL|EXTART|EXTBIN|EXTBYT|EXTGENRE|EXTGRP|EXTM3A|" +
    "EXTVLCOPT)(?![A-Z0-9-])|#PLAYLIST";

  var knownAttribute =
    "ALLOWED-CPC|ASSOC-LANGUAGE|AUDIO|AUTOSELECT|AVERAGE-BANDWIDTH|" +
    "BANDWIDTH|BIT-DEPTH|BYTERANGE|BYTERANGE-LENGTH|BYTERANGE-START|" +
    "CAN-BLOCK-RELOAD|CAN-SKIP-DATERANGES|CAN-SKIP-UNTIL|CHANNELS|" +
    "CHARACTERISTICS|CLASS|CLOSED-CAPTIONS|CODECS|CUE|DATA-ID|DEFAULT|" +
    "DURATION|END-DATE|END-ON-NEXT|FORCED|FORMAT|FRAME-RATE|GAP|GROUP-ID|" +
    "HDCP-LEVEL|HOLD-BACK|ID|IMPORT|INDEPENDENT|INSTREAM-ID|IV|KEYFORMAT|" +
    "KEYFORMATVERSIONS|LANGUAGE|LAST-MSN|LAST-PART|METHOD|NAME|" +
    "PART-HOLD-BACK|PART-TARGET|PATHWAY-ID|PLANNED-DURATION|PRECISE|" +
    "QUERYPARAM|RECENTLY-REMOVED-DATERANGES|REQ-VIDEO-LAYOUT|RESOLUTION|" +
    "SAMPLE-RATE|SCORE|SCTE35-CMD|SCTE35-IN|SCTE35-OUT|SERVER-URI|" +
    "SKIPPED-SEGMENTS|STABLE-RENDITION-ID|STABLE-VARIANT-ID|START-DATE|" +
    "SUBTITLES|SUPPLEMENTAL-CODECS|TIME-OFFSET|TYPE|URI|VALUE|VIDEO|" +
    "VIDEO-RANGE|PROGRAM-ID";

  var number = "(?:-?\\d+(?:\\.\\d+)?|0[xX][\\dA-Fa-f]+)";
  var quoted = /"(?:[^"\\\n]|\\.)*"/.source;

  var variable = /\{\$[^}\n]*\}/;

  // A whole value, after NAME=
  function value(pattern) {
    return RegExp("(^[^=]*=)(?:" + pattern + ")$");
  }

  // NAME=value. Known, X- and lowercase (IPTV, VLC) names are highlighted.
  var attribute = {
    pattern: RegExp("(^|[\\s,])[^\\s\"=,]+=(?:" + quoted + "|[^\\s\"=,][^\\s\",]*)"),
    lookbehind: true,
    inside: {
      "attr-value": {
        pattern: value(quoted),
        lookbehind: true,
        alias: "string",
      },
      number: {
        pattern: value(number + "|\\d+x\\d+"),
        lookbehind: true,
      },
      constant: {
        pattern: value("[A-Z][A-Z0-9-]*"),
        lookbehind: true,
      },
      boolean: {
        pattern: value("true|false"),
        lookbehind: true,
      },
      string: {
        pattern: /(^[^=]*=)[\s\S]+/,
        lookbehind: true,
      },
      "attr-name": RegExp(
        "^(?:" + knownAttribute + "|X-[^\\s\"=,]*|[^\\s\"=,]*[a-z][^\\s\"=,]*)(?==)",
      ),
      operator: /=/,
    },
  };

  // A bare word, e.g. the 6 in #EXT-X-TARGETDURATION:6
  function word(pattern) {
    return RegExp("(^|[\\s,])(?:" + pattern + ")(?=[\\s\",]|$)");
  }

  // Everything after the colon of a tag
  var tagValue = {
    attribute: attribute,
    "quoted-string": RegExp(quoted),
    "byte-range": {
      pattern: word("\\d+@\\d+"),
      lookbehind: true,
      inside: {
        number: /\d+/,
        punctuation: /@/,
      },
    },
    number: {
      pattern: word(number + "|\\d+x\\d+"),
      lookbehind: true,
    },
    date: {
      pattern: /(^|[\s,])\d{4}-\d{2}-\d{2}T[^\s"=,]*/,
      lookbehind: true,
      alias: "string",
    },
    constant: {
      pattern: word("[A-Z][A-Z0-9-]*"),
      lookbehind: true,
    },
    punctuation: /,/,
  };

  var extinfAttributes = '#EXTINF:[^,"\\n]*(?:' + quoted + '[^,"\\n]*)*';

  Prism.languages.m3u = {
    header: {
      pattern: /^\uFEFF?#EXTM3U(?![A-Z0-9-]).*/m,
      inside: {
        doctype: /#EXTM3U/,
        attribute: attribute,
      },
    },
    // #EXTINF:<duration>[ <attributes>][,<title>]
    extinf: {
      pattern: /^#EXTINF(?![A-Z0-9-]).*/m,
      inside: {
        title: {
          pattern: RegExp("(^" + extinfAttributes + ",)[\\s\\S]+"),
          lookbehind: true,
          alias: "string",
          inside: {
            variable: variable,
          },
        },
        attribute: attribute,
        punctuation: /,$/,
        duration: {
          pattern: /(^#EXTINF:[\t ]*)-?\d+(?:\.\d+)?/,
          lookbehind: true,
          alias: "number",
        },
        tag: /^#EXTINF/,
      },
    },
    directive: {
      pattern: /^#(?:EXT|PLAYLIST).*/m,
      inside: {
        value: {
          pattern: /(^#(?:EXT[A-Z0-9-]*|PLAYLIST):)[\s\S]+/,
          lookbehind: true,
          inside: tagValue,
        },
        tag: RegExp("^(?:" + knownTag + ")"),
      },
    },
    comment: /^#.*/m,
    uri: {
      pattern: /^[\t ]*[^#\s].*/m,
      alias: "url",
      inside: {
        variable: variable,
        escape: {
          pattern: /%[\dA-Fa-f]{2}/,
          alias: "entity",
        },
      },
    },
  };

  Prism.languages.m3u8 = Prism.languages.m3u;
})(Prism);
