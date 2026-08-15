-- Novo campo: prazo para homologação (texto livre, editável pelo admin)
alter table clients add column if not exists deadline text;

-- Novo campo: resultado quando chega na última etapa ('liberada' ou 'recusada')
alter table clients add column if not exists outcome text;

-- Remove os clientes de teste
delete from clients where name in ('Marcos Vinícius Andrade', 'Renata Ferreira Lima', 'João Pedro Salgado');
