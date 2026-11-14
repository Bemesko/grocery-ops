// SEFAZ-SC falsa para os testes: serve as páginas fictícias da NFC-e (tests/fixtures) pelos
// mesmos caminhos do site real. O app recebe NFCE_DESTINO_TESTE com o endereço deste servidor
// (só vale com GROCERY_TESTE=1) e continua validando os links como de sat.sef.sc.gov.br.
//
// O parâmetro rq do link escolhe a resposta:
//   NFCe_Detalhes.aspx?rq=simples    → página simples (desconto só no total)
//   Nfe_DetalheCert.aspx?rq=detalhada → página detalhada (desconto e EAN por item)
//   ...?rq=verificacao               → redireciona para a verificação (Turnstile)
//   ...?rq=limite                    → redireciona para "requisições excedidas"
import { readFileSync } from 'node:fs'
import http from 'node:http'
import type { AddressInfo } from 'node:net'

const fixture = (nome: string) => readFileSync(new URL(`../fixtures/${nome}`, import.meta.url), 'utf8')

export const CHAVE_FICTICIA = '42261111222333000181650010000012341123456788'
export const CNPJ_FICTICIO = '11222333000181'
const BASE = 'https://sat.sef.sc.gov.br/tax.NET'

export const LINKS = {
  qr: `https://sat.sef.sc.gov.br/nfce/consulta?p=${CHAVE_FICTICIA}|2|1|1|abcdef0123`,
  simples: `${BASE}/Sat.DFe.NFCe.Web/Consultas/NFCe_Detalhes.aspx?rq=simples`,
  detalhada: `${BASE}/Sat.NFe.Web/Consultas/Nfe_DetalheCert.aspx?rq=detalhada`,
  verificacao: `${BASE}/Sat.DFe.NFCe.Web/Consultas/NFCe_Detalhes.aspx?rq=verificacao`,
  limite: `${BASE}/Sat.DFe.NFCe.Web/Consultas/NFCe_Detalhes.aspx?rq=limite`,
}

/** Textos do consumidor/destinatário fictícios das fixtures: nunca podem ir para o banco. */
export const DADOS_PESSOAIS_FICTICIOS = ['000.000.000-00', 'FULANO', 'RUA FICTICIA', 'fulano@exemplo.invalid', '90000-0000']

const VERIFICACAO = '<html><body><div class="cf-turnstile" data-sitekey="x"></div>Verificação para prosseguimento</body></html>'
const LIMITE = '<html><body>O sistema detectou um número excessivo de requisições deste IP.</body></html>'

export interface SefazFalsa {
  url: string
  /** Caminho + query de cada requisição recebida. */
  chamadas: string[]
  fechar(): Promise<void>
}

export async function iniciarSefazFalsa(): Promise<SefazFalsa> {
  const chamadas: string[] = []
  const simples = fixture('nfce-ficticia.html')
  const detalhada = fixture('nfce-detalhada-ficticia.html')
  const servidor = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://x')
    chamadas.push(`${url.pathname}${url.search}`)
    const html = (corpo: string) => {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      res.end(corpo)
    }
    const redirecionar = (para: string) => {
      res.writeHead(302, { location: para })
      res.end()
    }
    const rq = url.searchParams.get('rq')
    if (url.pathname.endsWith('/SecurityVerify.aspx')) return html(VERIFICACAO)
    if (url.pathname.endsWith('/appMaximoRequisicoesExcedidas.html')) return html(LIMITE)
    if (rq === 'verificacao') return redirecionar('/tax.NET/SecurityVerify.aspx?rq=x')
    if (rq === 'limite') return redirecionar('/static/appMaximoRequisicoesExcedidas.html')
    if (url.pathname.endsWith('/NFCe_Detalhes.aspx') && rq === 'simples') return html(simples)
    if (url.pathname.endsWith('/Nfe_DetalheCert.aspx') && rq === 'detalhada') return html(detalhada)
    res.writeHead(404)
    res.end()
  })
  await new Promise<void>((ok) => servidor.listen(0, '127.0.0.1', ok))
  const { port } = servidor.address() as AddressInfo
  return {
    url: `http://127.0.0.1:${port}`,
    chamadas,
    fechar: () => new Promise((ok) => servidor.close(() => ok())),
  }
}
