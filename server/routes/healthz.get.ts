// Probes do Deployment e e2e (CI deste repo e do repo central).
export default defineEventHandler((event) => {
  setResponseHeader(event, 'content-type', 'text/plain')
  return 'ok'
})
