"use client";

import { useEffect, useMemo, useState } from "react";


const API_URL = "http://localhost:8000";
const SESSION_ID = "demo-session";

type Department = {
  id: number;
  name: string;
};

type SppNode = {
  id: number;
  parent_id: number | null;
  code: string;
  name: string;
  is_active: boolean;
  valid_from: string;
  valid_to: string | null;
  departments: Department[];
  children: SppNode[];
  amount: number;
};

type CalculationItem = {
  id: number;
  session_id: string;
  status: string;
  spp_version_date: string;
  created_at: string;
};

export default function HomePage() {
  const [dates, setDates] = useState<string[]>([]);
  const [versionDate, setVersionDate] = useState("");
  const [tree, setTree] = useState<SppNode[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [amount, setAmount] = useState("100000");
  const [redisId, setRedisId] = useState("");
  const [calculations, setCalculations] = useState<CalculationItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadDates();
    loadCalculations();

    const socket = new WebSocket(`ws://localhost:8000/ws/${SESSION_ID}`);

    socket.onmessage = () => {
      loadCalculations();
    };

    return () => socket.close();
  }, []);

  useEffect(() => {
    if (versionDate) {
      loadTree(versionDate);
    }
  }, [versionDate]);

  async function loadDates() {
    const response = await fetch(`${API_URL}/api/dates`);
    const data = await response.json();

    setDates(data);

    if (data.length > 0) {
      setVersionDate(data[0]);
    }
  }

  async function loadTree(date: string) {
    const response = await fetch(`${API_URL}/api/tree?version_date=${date}`);
    const data = await response.json();

    setTree(data);
    setSelectedIds([]);
    setRedisId("");
  }

  async function loadCalculations() {
    const response = await fetch(
      `${API_URL}/api/calculations?session_id=${SESSION_ID}`
    );
    const data = await response.json();

    setCalculations(data);
  }

  function findNodeById(nodes: SppNode[], id: number): SppNode | null {
    for (const node of nodes) {
      if (node.id === id) {
        return node;
      }

      const child = findNodeById(node.children, id);

      if (child) {
        return child;
      }
    }

    return null;
  }

  function getAllChildIds(node: SppNode): number[] {
    return [
      node.id,
      ...node.children.flatMap((child) => getAllChildIds(child))
    ];
  }

  function getParentIds(
    nodes: SppNode[],
    targetId: number,
    parents: number[] = []
  ): number[] {
    for (const node of nodes) {
      if (node.id === targetId) {
        return parents;
      }

      const result = getParentIds(
        node.children,
        targetId,
        [...parents, node.id]
      );

      if (result.length > 0) {
        return result;
      }
    }

    return [];
  }

  function toggleNode(id: number) {
    const node = findNodeById(tree, id);

    if (!node) return;

    const nodeIds = getAllChildIds(node);

    setSelectedIds((prev) => {
      let next = [...prev];

      const isSelected = prev.includes(id);

      if (isSelected) {
        next = next.filter((item) => !nodeIds.includes(item));

        const parents = getParentIds(tree, id);

        next = next.filter((item) => !parents.includes(item));
      } else {
        next = [...new Set([...next, ...nodeIds])];

        const parents = getParentIds(tree, id);

        for (const parentId of parents.reverse()) {
          const parentNode = findNodeById(tree, parentId);

          if (!parentNode) continue;

          const allChildrenSelected = parentNode.children.every(
            (child) => next.includes(child.id)
          );

          if (allChildrenSelected) {
            next.push(parentId);
          }
        }
      }

      return [...new Set(next)];
    });
  }


  // function getAllChildIds(node: SppNode): number[] {
  //   let ids = [node.id];

  //   for (const child of node.children) {
  //     ids = [...ids, ...getAllChildIds(child)];
  //   }

  //   return ids;
  // }

  // function toggleNode(id: number) {
  //   const findNode = (nodes: SppNode[]): SppNode | null => {
  //     for (const node of nodes) {
  //       if (node.id === id) return node;

  //       const child = findNode(node.children);

  //       if (child) return child;
  //     }

  //     return null;
  //   };

  //   const node = findNode(tree);

  //   if (!node) return;

  //   const idsToToggle = getAllChildIds(node);

  //   setSelectedIds((previous) => {
  //     const allSelected = idsToToggle.every((item) =>
  //       previous.includes(item)
  //     );

  //     if (allSelected) {
  //       return previous.filter(
  //         (item) => !idsToToggle.includes(item)
  //       );
  //     }

  //     return [...new Set([...previous, ...idsToToggle])];
  //   });
  // }

  // function toggleNode(id: number) {
  //   setSelectedIds((previous) => {
  //     if (previous.includes(id)) {
  //       return previous.filter((item) => item !== id);
  //     }

  //     return [...previous, id];
  //   });
  // }

  function getTopLevelSelectedIds(): number[] {
    function hasSelectedParent(
      targetId: number,
      nodes: SppNode[],
      parentSelected = false
    ): boolean {
      for (const node of nodes) {
        const currentSelected = selectedIds.includes(node.id);

        if (node.id === targetId) {
          return parentSelected;
        }

        const result = hasSelectedParent(
          targetId,
          node.children,
          parentSelected || currentSelected
        );

        if (result) {
          return true;
        }
      }

      return false;
    }

    return selectedIds.filter(
      (id) => !hasSelectedParent(id, tree)
    );
  }

  async function calculate() {
    setLoading(true);

    try {
      const topLevelIds = getTopLevelSelectedIds();

      const response = await fetch(`${API_URL}/api/calculate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          selected_ids: topLevelIds,
          total_amount: Number(amount),
          version_date: versionDate,
          session_id: SESSION_ID
        })
      });

      const data = await response.json();

      setRedisId(data.redis_id);
      setTree(data.tree);
    } finally {
      setLoading(false);
    }
  }

  // async function calculate() {
  //   setLoading(true);

  //   try {
  //     const response = await fetch(`${API_URL}/api/calculate`, {
  //       method: "POST",
  //       headers: {
  //         "Content-Type": "application/json"
  //       },

  //       const topLevelIds = getTopLevelSelectedIds();

  //       body: JSON.stringify({
  //         selected_ids: topLevelIds,
  //         total_amount: Number(amount),
  //         version_date: versionDate,
  //         session_id: SESSION_ID
  //       })
  //     });

  //     const data = await response.json();

  //     setRedisId(data.redis_id);
  //     setTree(data.tree);
  //   } finally {
  //     setLoading(false);
  //   }
  // }

  async function saveCalculation() {
    if (!redisId) return;

    await fetch(`${API_URL}/api/save/${redisId}`, {
      method: "POST"
    });

    setRedisId("");
    await loadCalculations();
  }

  async function loadCalculation(id: number) {
    const response = await fetch(`${API_URL}/api/calculations/${id}`);
    const data = await response.json();

    setTree(data.result_json.tree);
    setVersionDate(data.spp_version_date);
    setRedisId("");
  }

  function downloadExcel(id: number) {
    window.open(`${API_URL}/api/export/${id}`, "_blank");
  }

  const selectedCount = useMemo(() => selectedIds.length, [selectedIds]);

  return (
    <main className="page">
      <header className="header">
        <h1>Модуль управления СПП</h1>
        <p>
          Дерево СПП, исторические срезы, распределение суммы, Redis,
          PostgreSQL и Excel-экспорт.
        </p>
      </header>

      <div className="grid">
        <section className="card">
          <h2>Структура СПП</h2>
          <div className="controls">
            <select
              className="select"
              value={versionDate}
              onChange={(event) => setVersionDate(event.target.value)}
            >
              {dates.map((date) => (
                <option key={date} value={date}>
                  {date}
                </option>
              ))}
            </select>

            <input
              className="input"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="Сумма"
              type="number"
            />

            <button
              className="button"
              onClick={calculate}
              disabled={loading || selectedCount === 0}
            >
              Выполнить
            </button>

            <button
              className="button secondary"
              onClick={saveCalculation}
              disabled={!redisId}
            >
              Сохранить
            </button>
          </div>

          <p>Выбрано элементов: {selectedCount}</p>

          {tree.map((node) => (
            <TreeNode
              key={node.id}
              node={node}
              selectedIds={selectedIds}
              onToggle={toggleNode}
            />
          ))}
        </section>

        <section className="card">
          <h2>Сохраненные расчеты</h2>

          {calculations.length === 0 && <p>Пока нет сохраненных расчетов.</p>}

          {calculations.map((item) => (
            <div className="saved-item" key={item.id}>
              <strong>Расчет #{item.id}</strong>
              <br />
              <small>
                Дата СПП: {item.spp_version_date} | Статус: {item.status}
              </small>
              <br />
              <small>{new Date(item.created_at).toLocaleString()}</small>

              <div className="controls" style={{ marginTop: 10 }}>
                <button
                  className="button"
                  onClick={() => loadCalculation(item.id)}
                >
                  Открыть
                </button>

                <button
                  className="button secondary"
                  onClick={() => downloadExcel(item.id)}
                >
                  Excel
                </button>
              </div>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}

function TreeNode({
  node,
  selectedIds,
  onToggle
}: {
  node: SppNode;
  selectedIds: number[];
  onToggle: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  const checked = selectedIds.includes(node.id);
  const hasChildren = node.children.length > 0;

  return (
    <div className="tree-node">
      <div className={`node-row ${checked ? "selected" : ""}`}>
        <button
          className="expand-button"
          onClick={() => setExpanded(!expanded)}
          disabled={!hasChildren}
          type="button"
        >
          {hasChildren ? (expanded ? "▼" : "▶") : "•"}
        </button>

        <input
          type="checkbox"
          checked={checked}
          onChange={() => onToggle(node.id)}
        />

        <div className="node-main">
          <div className="node-title">
            <span className="node-code">{node.code}</span>
            <span>{node.name}</span>

            <span className={node.is_active ? "status active" : "status inactive"}>
              {node.is_active ? "Действующий" : "Недействующий"}
            </span>
          </div>

          {node.departments.length > 0 && (
            <div className="department-list">
              {node.departments.map((department) => (
                <span className="department-badge" key={department.id}>
                  {department.name}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="node-amount">
          {node.amount > 0 ? `${node.amount.toLocaleString("ru-RU")} ₽` : "—"}
        </div>
      </div>

      {hasChildren && expanded && (
        <div className="children">
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              selectedIds={selectedIds}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}