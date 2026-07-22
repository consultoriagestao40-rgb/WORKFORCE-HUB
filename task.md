# Lista de Tarefas - Módulo de Relatórios Analíticos

- [x] Criar arquivo de ações do servidor `src/app/admin/reports/actions.ts`
- [x] Adicionar link "Relatórios" no Sidebar `src/components/admin/SidebarNav.tsx`
- [x] Criar a página servidora Next.js `src/app/admin/reports/page.tsx`
- [x] Criar a interface cliente `src/app/admin/reports/ReportsClientPage.tsx`
  - [x] Implementar as 5 abas de relatórios (Turnover, Absenteísmo, Cobertura, Colaboradores, R&S)
  - [x] Adicionar os cards de KPIs no topo de cada aba
  - [x] Desenhar as tabelas matrizes de 12 meses + acumulado/média
  - [x] Criar os modais detalhados para cada métrica com rolagem nativa e exportação
  - [x] Implementar exportação geral das matrizes para Excel usando `xlsx`
- [x] Validar e testar build completo com `npm run build`
