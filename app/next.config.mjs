export default {
  serverExternalPackages: ["pdfjs-dist"],
  outputFileTracingIncludes: { "/api/review": ["./node_modules/pdfjs-dist/legacy/build/**", "./node_modules/pdfjs-dist/standard_fonts/**"] },
};
