/**
 * Quantas colunas o rodapé abre, e até onde ele se espalha.
 *
 * O PROBLEMA QUE ISSO RESOLVE
 *
 * O rodapé mostra três coisas: telefone, horário e endereço. Só que nem toda
 * loja preenche as três. A grade, porém, sempre reservava três lugares — e
 * quando só dois estavam preenchidos, os dois blocos ficavam encostados à
 * esquerda com um vão enorme sobrando à direita. Medido num monitor de
 * 1280px: 426px de vazio com dois campos, 853px com um só.
 *
 * É a mesa posta para três com dois pratos: não está errada, está torta.
 *
 * A CORREÇÃO
 *
 * A grade passa a abrir exatamente o número de lugares que vai usar, e o
 * conjunto fica centralizado. Com os três campos preenchidos — o caso da
 * maioria das lojas — nada muda: continua exatamente como estava.
 */
export function gradeParaBlocos(quantos: number): string {
  if (quantos >= 3) return "sm:grid-cols-3";
  if (quantos === 2) return "sm:grid-cols-2 sm:max-w-3xl";
  return "sm:grid-cols-1 sm:max-w-sm";
}
