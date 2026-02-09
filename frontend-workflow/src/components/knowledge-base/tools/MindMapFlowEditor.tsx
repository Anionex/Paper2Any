import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import ReactFlow, { Background, Controls, MiniMap, Edge, Node, ReactFlowInstance, useEdgesState, useNodesState } from 'reactflow';
import { Plus, RefreshCw, CheckCircle2, Maximize2, Minimize2, Move } from 'lucide-react';
import 'reactflow/dist/style.css';

interface MindMapFlowEditorProps {
  mermaidCode: string;
  onApply: (code: string) => void;
}

interface TreeNode {
  id: string;
  label: string;
  children: TreeNode[];
}

const normalizeLabel = (raw: string) => {
  const trimmed = raw.trim();
  const rootMatch = trimmed.match(/\(\((.+?)\)\)/);
  if (rootMatch) return rootMatch[1].trim();
  const bracketMatch = trimmed.match(/\[(.+?)\]/);
  if (bracketMatch) return bracketMatch[1].trim();
  return trimmed.replace(/^root\s*/i, '').replace(/^[-*]\s*/, '').trim() || '节点';
};

const buildTreeFromMermaid = (code: string): TreeNode | null => {
  const lines = code
    .split('\n')
    .map(line => line.replace(/\t/g, '  '))
    .filter(line => line.trim());

  const contentLines = lines.filter(line => !line.trim().toLowerCase().startsWith('mindmap'));
  if (contentLines.length === 0) return null;

  const baseIndent = contentLines[0].match(/^\s*/)?.[0].length ?? 0;
  const stack: { depth: number; node: TreeNode }[] = [];
  let root: TreeNode | null = null;

  contentLines.forEach((line, index) => {
    const indent = line.match(/^\s*/)?.[0].length ?? 0;
    const depth = Math.max(0, Math.floor((indent - baseIndent) / 2));
    const label = normalizeLabel(line);
    const node: TreeNode = { id: `mm_${Date.now()}_${index}`, label, children: [] };

    if (depth === 0) {
      root = node;
      stack.length = 0;
      stack.push({ depth, node });
      return;
    }

    while (stack.length > 0 && stack[stack.length - 1].depth >= depth) {
      stack.pop();
    }

    const parent = stack[stack.length - 1]?.node;
    if (parent) {
      parent.children.push(node);
    } else if (!root) {
      root = node;
    }

    stack.push({ depth, node });
  });

  return root;
};

const buildFlowFromTree = (root: TreeNode | null) => {
  if (!root) {
    const fallbackNode: Node = {
      id: 'root',
      data: { label: '中心主题' },
      position: { x: 0, y: 0 }
    };
    return { nodes: [fallbackNode], edges: [] };
  }

  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const depthIndex: Record<number, number> = {};

  const walk = (node: TreeNode, depth: number, parentId?: string) => {
    depthIndex[depth] = depthIndex[depth] ?? 0;
    const y = depthIndex[depth] * 110;
    const x = depth * 240;
    depthIndex[depth] += 1;

    nodes.push({
      id: node.id,
      data: { label: node.label },
      position: { x, y },
      draggable: true
    });

    if (parentId) {
      edges.push({
        id: `${parentId}-${node.id}`,
        source: parentId,
        target: node.id,
        type: 'smoothstep'
      });
    }

    node.children.forEach(child => walk(child, depth + 1, node.id));
  };

  walk(root, 0);
  return { nodes, edges };
};

const flowToMermaid = (nodes: Node[], edges: Edge[]) => {
  if (nodes.length === 0) {
    return 'mindmap\n  root((中心主题))';
  }

  const nodeById = new Map(nodes.map(n => [n.id, n]));
  const incoming = new Set(edges.map(e => e.target));
  const root = nodes.find(n => !incoming.has(n.id)) || nodes[0];
  const childrenMap = new Map<string, Node[]>();

  edges.forEach(edge => {
    const child = nodeById.get(edge.target);
    if (!child) return;
    const list = childrenMap.get(edge.source) || [];
    list.push(child);
    childrenMap.set(edge.source, list);
  });

  childrenMap.forEach(list => {
    list.sort((a, b) => (a.position?.y ?? 0) - (b.position?.y ?? 0));
  });

  const lines: string[] = [];
  const rootLabel = (root.data as any)?.label || '中心主题';
  lines.push('mindmap');
  lines.push(`  root((${rootLabel}))`);

  const walk = (node: Node, depth: number) => {
    const children = childrenMap.get(node.id) || [];
    children.forEach(child => {
      const label = (child.data as any)?.label || '节点';
      lines.push(`${'  '.repeat(depth + 1)}${label}`);
      walk(child, depth + 1);
    });
  };

  walk(root, 0);
  return lines.join('\n');
};

export const MindMapFlowEditor = ({ mermaidCode, onApply }: MindMapFlowEditorProps) => {
  const initial = useMemo(() => buildFlowFromTree(buildTreeFromMermaid(mermaidCode)), [mermaidCode]);
  const [nodes, setNodes, onNodesChange] = useNodesState(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [flowInstance, setFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const selectedNode = nodes.find(n => n.id === selectedNodeId) || null;

  useEffect(() => {
    const rebuilt = buildFlowFromTree(buildTreeFromMermaid(mermaidCode));
    setNodes(rebuilt.nodes);
    setEdges(rebuilt.edges);
    setSelectedNodeId(null);
  }, [mermaidCode, setNodes, setEdges]);

  const handleAddChild = () => {
    const parent = selectedNode || nodes[0];
    if (!parent) return;
    const newId = `node_${Date.now()}`;
    const newNode: Node = {
      id: newId,
      data: { label: '新节点' },
      position: {
        x: (parent.position?.x || 0) + 240,
        y: (parent.position?.y || 0) + 110
      }
    };
    setNodes(prev => [...prev, newNode]);
    setEdges(prev => [
      ...prev,
      { id: `${parent.id}-${newId}`, source: parent.id, target: newId, type: 'smoothstep' }
    ]);
    setSelectedNodeId(newId);
  };

  const handleResetLayout = () => {
    const rebuilt = buildFlowFromTree(buildTreeFromMermaid(flowToMermaid(nodes, edges)));
    setNodes(rebuilt.nodes);
    setEdges(rebuilt.edges);
  };

  const handleFitView = () => {
    flowInstance?.fitView({ padding: 0.2 });
  };

  const flowCanvas = (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={(_, node) => setSelectedNodeId(node.id)}
      onInit={(instance) => setFlowInstance(instance)}
      fitView
    >
      <Background gap={20} size={1} color="#2a2a3a" />
      <MiniMap nodeColor="#38bdf8" />
      <Controls />
    </ReactFlow>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={handleAddChild}
          className="px-3 py-1.5 text-xs rounded-lg bg-white/10 hover:bg-white/20 text-gray-200 transition-colors flex items-center gap-1"
        >
          <Plus size={14} /> 新建分支
        </button>
        <button
          onClick={handleResetLayout}
          className="px-3 py-1.5 text-xs rounded-lg bg-white/10 hover:bg-white/20 text-gray-200 transition-colors flex items-center gap-1"
        >
          <RefreshCw size={14} /> 重置布局
        </button>
        <button
          onClick={() => onApply(flowToMermaid(nodes, edges))}
          className="px-3 py-1.5 text-xs rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 transition-colors flex items-center gap-1"
        >
          <CheckCircle2 size={14} /> 应用到代码
        </button>
        <button
          onClick={() => setIsFullscreen(true)}
          className="px-3 py-1.5 text-xs rounded-lg bg-white/10 hover:bg-white/20 text-gray-200 transition-colors flex items-center gap-1"
        >
          <Maximize2 size={14} /> 全屏编辑
        </button>
        <button
          onClick={handleFitView}
          className="px-3 py-1.5 text-xs rounded-lg bg-white/10 hover:bg-white/20 text-gray-200 transition-colors flex items-center gap-1"
        >
          <Move size={14} /> 适配视图
        </button>
      </div>

      <div className="bg-black/30 border border-white/10 rounded-lg p-3">
        <div className="text-xs text-gray-400 mb-2">选中节点编辑</div>
        <input
          type="text"
          value={(selectedNode?.data as any)?.label || ''}
          onChange={(e) => {
            const value = e.target.value;
            setNodes(prev => prev.map(node => node.id === selectedNodeId ? { ...node, data: { ...node.data, label: value } } : node));
          }}
          placeholder="请选择节点"
          className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-gray-200 outline-none focus:border-cyan-500"
        />
      </div>

      {!isFullscreen && (
        <div className="h-[420px] bg-black/20 border border-white/10 rounded-lg overflow-hidden">
          {flowCanvas}
        </div>
      )}

      {isFullscreen && createPortal(
        <div className="fixed inset-0 z-[300] bg-black/70 backdrop-blur-md flex items-center justify-center p-6" onClick={() => setIsFullscreen(false)}>
          <div className="w-[95vw] h-[92vh] bg-[#0b0b1a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <div className="text-sm text-gray-300">思维导图全屏编辑</div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleFitView}
                  className="px-2 py-1 text-xs rounded-lg bg-white/5 hover:bg-white/10 text-gray-300"
                >
                  适配视图
                </button>
                <button
                  onClick={() => setIsFullscreen(false)}
                  className="px-2 py-1 text-xs rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 flex items-center gap-1"
                >
                  <Minimize2 size={14} /> 退出全屏
                </button>
              </div>
            </div>
            <div className="flex-1 bg-black/20">
              {flowCanvas}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
