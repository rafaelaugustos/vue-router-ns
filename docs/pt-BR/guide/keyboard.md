# Comandos nativos de teclado

Use `useNavigationCommands()` no setup da página e envolva seu conteúdo com `NavigationCommandScope`, dentro de `Page`. O scope é um GridLayout nativo: aceita `rows`, `columns` e os estilos normais. No iOS 13+ participa da cadeia de responders do UIKit e oferece descoberta com UIKeyCommand. No Android recebe teclas nativas não tratadas pelo controle focado, por ViewCompat.

Cada comando tem `id`, `title` (string/ref/getter), `shortcut: { input, modifiers? }`, `action` e, opcionalmente, `enabled` (boolean/ref/getter) e `allowInTextInput`. A lista também aceita ref/getter. Escolha `meta` no iOS e `ctrl` no Android quando apropriado; também existem `alt` e `shift`. Entradas: caracteres com modificador, Escape, setas (`ArrowLeft`, etc.), Enter e Tab. Use ids/atalhos únicos e um único scope por registro.

`action: 'back'` volta pela fila e pelos guards, desabilitado na raiz não modal. `'closeModal'` fecha toda a pilha modal cancelável pelos guards. Uma função recebe o router tipado daquela página para ações de aplicação, incluindo próximo/anterior destino ou aba. Não existe histórico nativo de avanço. O demo mostra troca de abas na NativeWindow da própria página.

`list()` retorna títulos e disponibilidade atuais. `execute(id)` resolve se o comando foi despachado, não se um guard permitiu a navegação. Repetições ficam desabilitadas enquanto a ação executa. `focus()` seleciona o responder da coluna sem roubar foco de um editor; tocar no conteúdo também seleciona o scope quando possível.

Por padrão, comandos não executam em editores. `allowInTextInput: true` habilita exceções como fechar modal com Escape, sempre respeitando composição de IME. Selecionar/copiar/colar/recortar/desfazer/refazer nunca podem virar comandos do router. Não registre atalhos reservados pelo sistema.

Escape pertence primeiro ao controle/IME nativo. Para um binding Escape habilitado, uma busca ativa da página é fechada antes da ação. Overlays da aplicação podem registrar sua própria ação. Um binding explícito de `closeModal` passa pelos guards. Não há atalhos automáticos. Campos do UISearchController fora do conteúdo mantêm o comportamento nativo do UIKit.

Scopes de abas ocultas, páginas cobertas e hosts destruídos não despacham comandos. Cada janela mantém sua própria cadeia de responders/views, e modais abrem explicitamente na página de origem. Retenção de histórico após recriação de Activity/reconexão de scene continua na #46.

Veja a [receita completa em inglês](/guide/keyboard), [guards](./guards) e [busca nativa](./native-bars).
