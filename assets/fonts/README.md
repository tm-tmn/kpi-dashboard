Sarabun (SIL Open Font License 1.1, https://github.com/cadsondemak/Sarabun),
taken from @fontsource/sarabun (thai + latin subsets, weights 400/700) and
converted woff -> ttf. Used only by the PDF report (lib/report-pdf.tsx).

Local patch (fontTools): the Thai subset gets an empty zero-width glyph mapped
to U+002D, U+00AD, U+2010, U+2011 and U+200B. react-pdf appends "-" at a
mid-word line break, which the Thai subset lacks (drew a tofu box); the Latin
font is listed first in fontFamily so genuine hyphens still render normally.
