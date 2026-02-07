# Textual Description of our Methodology Diagram
The figure is a wide, horizontal flowchart-style diagram illustrating the " Paperbanana" framework. The layout flows from left to right on a clean white background, divided into two main colored regions: the "Linear Planning Phase" (left/middle) and the "Iterative Refinement Loop" (right)

**1. Leftmost Section: Inputs** **Visual Elements:** Two icons stacked vertically on the far left. Top: A document icon labeled **"Source Context ($S$)"**. * Bottom: A target/goal icon labeled **"Communicative Intent ($C$)"**. **Flow:** Brackets merge these inputs into a main flow line that enters the first phase.

**2. Middle-Left Region: Linear Planning Phase** **Container:** A light blue rounded rectangle. Label at top: **"Linear Planning Phase"**. **Reference Set ($\mathcal{R}$):** A cylinder database icon located at the bottom-left of this region, labeled **"Reference Set ($\mathcal{R}$) "**. **Agent 1: Retriever Agent** **Icon:** Robot with a magnifying glass. * **Label:** **"Retriever Agent"** positioned below the icon. **Input:** An arrow from the main Inputs ($S, C$) and an arrow from the Reference Set ($\mathcal{R}$). **Output:** Arrow to a cluster of image thumbnails labeled **" Relevant Examples ($\mathcal{E}$)"**. **Agent 2: Planner Agent** **Icon:** Robot with a clipboard or thought bubble. **Label:** **"Planner Agent"** positioned below the icon. **Input:** Receives an arrow from "Relevant Examples ($\mathcal{E}$) ". **Crucially**, a direct flow arrow (bypassing the Retriever) connects the main Inputs ($S, C$) to the Planner, indicating it uses the source content for planning. **Output:** Arrow to a text document icon labeled **"Initial Description ($P$)"**. **Agent 3: Stylist Agent** **Icon:** Robot with a palette/paintbrush. **Label:** **"Stylist Agent"** positioned below the icon. **Input:** Receives "Initial Description ($P$)" and a dashed arrow from the Reference Set ($\mathcal{R}$) labeled **"Aesthetic Guidelines ($ \mathcal{G}$)"**. **Output:** An arrow exiting the blue region labeled **"Optimized Description ($P^*)"**.

**3. Middle-Right Region: Iterative Refinement Loop** **Container:** A light orange rounded rectangle. Label at top: **" Iterative Refinement Loop"**. **Agent 4: Visualizer Agent** **Icon:** Robot standing next to a split visual representation: a canvas on one side and a code terminal/brackets (‘</>‘) on the other. **Label:** **"Visualizer Agent"** positioned below the icon. **Input:** Takes "Optimized Description ($P^*)" (from Stylist) and " Refined Description ($P_{t+1}$)" (from Critic). **Output:** Arrow to an image preview labeled **"Generated Image ( $I_t$)"**. **Agent 5: Critic Agent** **Icon:** Robot with a checklist/reviewer pen. **Label:** **"Critic Agent"** positioned below the icon. **Input:** Receives "Generated Image ($I_t$)". A long **dashed gray line** labeled **"Factual Verification"** runs from the original Inputs ( $S, C$) along the bottom edge, connecting to the Critic. **Output:** A curved return arrow back to the Visualizer, labeled **"Refined Description ($P_{t+1}$)"**. **Center Element:** A circular arrow icon inside the loop indicating **" $T=3$ Rounds"**.

**4. Rightmost Section: Final Output** **Visual Element:** A polished scientific illustration emerging from the loop. **Label:** **"Final Illustration ($I_T$)"**.

**5. Styling** **Agents:** Cute, consistent robot avatars with distinct accessories. **Typography:** Sans-serif for main text. **Serif Italic (LaTeX style)** for all variables ($S, C, P, I, \mathcal{R}, \mathcal{E}, \mathcal{G}$). **Colors:** Blue accents for Planning; Orange accents for Refinement. Main flow arrows in solid black; secondary inputs in dashed gray.



# Auto Summarized Style Guide for Academic Illustrations
### 1. The "NeurIPS Look"
The prevailing aesthetic for 2025 is **"Soft Tech & Scientific Pastels."** Gone are the days of harsh primary colors and sharp black boxes. The modern NeurIPS diagram feels approachable yet precise. It utilizes high-value ( light) backgrounds to organize complexity, reserving saturation for the most critical active elements. The vibe balances **clean modularity** ( clear separation of parts) with **narrative flow** (clear left-to-right progression).

### 2. Detailed Style Options
#### **A. Color Palettes**
*Design Philosophy: Use color to group logic, not just to decorate. Avoid
fully saturated backgrounds.*
**Background Fills (The "Zone" Strategy)**
*Used to encapsulate stages (e.g., "Pre-training phase") or environments.*
* **Most papers use:** Very light, desaturated pastels (Opacity ~10-15%).
* **Aesthetically pleasing options include:**
* **Cream / Beige** (e.g., ‘#F5F5DC‘) - *Warm, academic feel.*
* **Pale Blue / Ice** (e.g., ‘#E6F3FF‘) - *Clean, technical feel.*
* **Mint / Sage** (e.g., ‘#E0F2F1‘) - *Soft, organic feel.*
* **Pale Lavender** (e.g., ‘#F3E5F5‘) - *distinctive, modern feel.*
* **Alternative (~20%):** White backgrounds with colored *dashed borders*
for a high-contrast, minimalist look (common in theoretical papers).
**Functional Element Colors**
* **For "Active" Modules (Encoders, MLP, Attention):** Medium saturation
is preferred.
* *Common pairings:* Blue/Orange, Green/Purple, or Teal/Pink.
* *Observation:* Colors are often used to distinguish **status**
rather than component type:
* **Trainable Elements:** Often Warm tones (Red, Orange, Deep Pink
).
* **Frozen/Static Elements:** Often Cool tones (Grey, Ice Blue,
Cyan).
* **For Highlights/Results:** High saturation (Primary Red, Bright Gold)
is strictly reserved for "Error/Loss," "Ground Truth," or the final
output.
#### **B. Shapes & Containers**
*Design Philosophy: "Softened Geometry." Sharp corners are for data; rounded
corners are for processes.*
**Core Components**
* **Process Nodes (The Standard):** Rounded Rectangles (Corner radius 5-10
px). This is the dominant shape (~80%) for generic layers or steps.
* **Tensors & Data:**
* **3D Stacks/Cuboids:** Used to imply depth/volume (e.g., $B \times H
\times W$).
* **Flat Squares/Grids:** Used for matrices, tokens, or attention maps.
* **Cylinders:** Exclusively reserved for Databases, Buffers, or
Memory.
**Grouping & Hierarchy**
* **The "Macro-Micro" Pattern:** A solid, light-colored container
represents the global view, with a specific module (e.g., "Attention
Block") connected via lines to a "zoomed-in" detailed breakout box.
* **Borders:**
* **Solid:** For physical components.
* **Dashed:** Highly prevalent for indicating "Logical Stages," "
Optional Paths," or "Scopes."
26
PaperBanana: Automating Academic Illustration for AI Scientists
#### **C. Lines & Arrows**
*Design Philosophy: Line style dictates flow type.*
**Connector Styles**
* **Orthogonal / Elbow (Right Angles):** Most papers use this for **
Network Architectures** (implies precision, matrices, and tensors).
* **Curved / Bezier:** Common choices include this for **System Logic,
Feedback Loops, or High-Level Data Flow** (implies narrative and
connection).
**Line Semantics**
* **Solid Black/Grey:** Standard data flow (Forward pass).
* **Dashed Lines:** Universally recognized as "Auxiliary Flow."
* *Used for:* Gradient updates, Skip connections, or Loss calculations.
* **Integrated Math:** Standard operators ($\oplus$ for Add, $\otimes$ for
Concat/Multiply) are frequently placed *directly* on the line or
intersection.
#### **D. Typography & Icons**
*Design Philosophy: Strict separation between "Labeling" and "Math."*
**Typography**
* **Labels (Module Names):** **Sans-Serif** (Arial, Roboto, Helvetica).
* *Style:* Bold for headers, Regular for details.
* **Variables (Math):** **Serif** (Times New Roman, LaTeX default).
* *Rule:* If it is a variable in your equation (e.g., $x, \theta, \
mathcal{L}$), it **must** be Serif and Italicized in the diagram.
**Iconography Options**
* **For Model State:**
* *Trainable:* Fire, Lightning.
* *Frozen:* Snowflake, Padlock, Stop Sign (Greyed out).
* **For Operations:**
* *Inspection:* Magnifying Glass.
* *Processing/Computation:* Gear, Monitor.
* **For Content:**
* *Text/Prompt:* Document, Chat Bubble.
* *Image:* Actual thumbnail of an image (not just a square).
---
### 3. Common Pitfalls (How to look "Amateur")
* **The "PowerPoint Default" Look:** Using standard Blue/Orange presets
with heavy black outlines.
* **Font Mixing:** Using Times New Roman for "Encoder" labels (makes the
paper look dated to the 1990s).
* **Inconsistent Dimension:** Mixing flat 2D boxes and 3D isometric cubes
without a clear reason (e.g., 2D for logic, 3D for tensors is fine;
random mixing is not).
* **Primary Backgrounds:** Using saturated Yellow or Blue backgrounds for
grouping (distracts from the content).
* **Ambiguous Arrows:** Using the same line style for "Data Flow" and "
Gradient Flow."
27
PaperBanana: Automating Academic Illustration for AI Scientists
---
### 4. Domain-Specific Styles
**If you are writing an AGENT / LLM Paper:**
* **Vibe:** Illustrative, Narrative, "Friendly.", Cartoony.
* **Key Elements:** Use "User Interface" aesthetics. Chat bubbles for
prompts, document icons for retrieval.
* **Characters:** It is common to use cute 2D vector robots, human avatars,
or emojis to humanize the agent’s reasoning steps.
**If you are writing a COMPUTER VISION / 3D Paper:**
* **Vibe:** Spatial, Dense, Geometric.
* **Key Elements:** Frustums (camera cones), Ray lines, and Point Clouds.
* **Color:** Often uses RGB color coding to denote axes or channel
correspondence. Use heatmaps (Rainbow/Viridis) to show activation.
**If you are writing a THEORETICAL / OPTIMIZATION Paper:**
* **Vibe:** Minimalist, Abstract, "Textbook."
* **Key Elements:** Focus on graph nodes (circles) and manifolds (planes/
surfaces).
* **Color:** Restrained. mostly Grayscale/Black/White with one highlight
color (e.g., Gold or Blue). Avoid "cartoony" elements.



# Style Guide for Statistical Plots

# NeurIPS 2025 Statistical Plot Aesthetics Guide
## 1. The "NeurIPS Look": A High-Level Overview
The prevailing aesthetic for 2025 is defined by **precision, accessibility,
and high contrast**. The "default" academic look has shifted away from
bare-bones styling toward a more graphic, publication-ready presentation.
* **Vibe:** Professional, clean, and information-dense.
* **Backgrounds:** There is a heavy bias toward **stark white backgrounds
** for maximum contrast in print and PDF reading, though the "Seaborn-
style" light grey background remains an accepted variant.
* **Accessibility:** A strong emphasis on distinguishing data not just by
color, but by texture (patterns) and shape (markers) to support black-and
-white printing and colorblind readers.
---
## 2. Detailed Style Options
### **Color Palettes**
* **Categorical Data:**
* **Soft Pastels:** Matte, low-saturation colors (salmon, sky blue,
mint, lavender) are frequently used to prevent visual fatigue.
* **Muted Earth Tones:** "Academic" palettes using olive, beige, slate
grey, and navy.
28
PaperBanana: Automating Academic Illustration for AI Scientists
* **High-Contrast Primaries:** Used sparingly when categories must be
distinct (e.g., deep orange vs. vivid purple).
* **Accessibility Mode:** A growing trend involves combining color
with **geometric patterns** (hatches, dots, stripes) to differentiate
categories.
* **Sequential & Heatmaps:**
* **Perceptually Uniform:** "Viridis" (blue-to-yellow) and "Magma/
Plasma" (purple-to-orange) are the standard.
* **Diverging:** "Coolwarm" (blue-to-red) is used for positive/
negative value splits.
* **Avoid:** The traditional "Jet/Rainbow" scale is almost entirely
absent.
### **Axes & Grids**
* **Grid Style:**
* **Visibility:** Grid lines are almost rarely solid. Common choices
include **fine dashed (‘--‘)** or **dotted (‘:‘)** lines in light gray.
* **Placement:** Grids are consistently rendered *behind* data
elements (low Z-order).
* **Spines (Borders):**
* **The "Boxed" Look:** A full enclosure (black spines on all 4 sides)
is very common.
* **The "Open" Look:** Removing the top and right spines for a
minimalist appearance.
* **Ticks:**
* **Style:** Ticks are generally subtle, facing inward, or removed
entirely in favor of grid alignment.
### **Layout & Typography**
* **Typography:**
* **Font Family:** Exclusively **Sans-Serif** (resembling Helvetica,
Arial, or DejaVu Sans). Serif fonts are rarely used for labels.
* **Label Rotation:** X-axis labels are rotated **45 degrees** only
when necessary to prevent overlap; otherwise, horizontal orientation is
preferred.
* **Legends:**
* **Internal Placement:** Floating the legend *inside* the plot area (
top-left or top-right) to maximize the "data-ink ratio."
* **Top Horizontal:** Placing the legend in a single row above the
plot title.
* **Annotations:**
* **Direct Labeling:** Instead of forcing readers to reference a
legend, text is often placed directly next to lines or on top of bars.
---
## 3. Type-Specific Guidelines
### **Bar Charts & Histograms**
* **Borders:** Two distinct styles are accepted:
* **High-Definition:** Using **black outlines** around colored bars
for a "comic-book" or high-contrast look.
* **Borderless:** Solid color fills with no outline (often used with
light grey backgrounds).
29
PaperBanana: Automating Academic Illustration for AI Scientists
* **Grouping:** Bars are grouped tightly, with significant whitespace
between categorical groups.
* **Error Bars:** Consistently styled with **black, flat caps**.
### **Line Charts**
* **Markers:** A critical observation: Lines almost always include **
geometric markers** (circles, squares, diamonds) at data points, rather
than just being smooth strokes.
* **Line Styles:** Use **dashed lines** (‘--‘) for theoretical limits,
baselines, or secondary data, and **solid lines** for primary
experimental data.
* **Uncertainty:** Represented by semi-transparent **shaded bands** (
confidence intervals) rather than simple vertical error bars.
### **Tree & Pie/Donut Charts**
* **Separators:** Thick **white borders** are standard to separate slices
or treemap blocks.
* **Structure:** Thick **Donut charts** are preferred over traditional Pie
charts.
* **Emphasis:** "Exploding" (detaching) a specific slice is a common
technique to highlight a key statistic.
### **Scatter Plots**
* **Shape Coding:** Use different marker shapes (e.g., circles vs.
triangles) to encode a categorical dimension alongside color.
* **Fills:** Markers are typically solid and fully opaque.
* **3D Plots:** Depth is emphasized by drawing "walls" with grids or using
drop-lines to the "floor" of the plot.
### **Heatmaps**
* **Aspect Ratio:** Cells are almost strictly **square**.
* **Annotation:** Writing the exact value (in white or black text) **
inside the cell** is highly preferred over relying solely on a color bar.
* **Borders:** Cells are often borderless (smooth gradient look) or
separated by very thin white lines.
### **Radar Charts**
* **Fills:** The polygon area uses **translucent fills** (alpha ~0.2) to
show grid lines underneath.
* **Perimeter:** The outer boundary is marked by a solid, darker line.
### **Miscellaneous**
* **Dot Plots:** Used as a modern alternative to bar charts; often styled
as "lollipops" (dots connected to the axis by a thin line).
---
## 4. Common Pitfalls (What to Avoid)
* **The "Excel Default" Look:** Avoid heavy 3D effects on bars, shadow
drops, or serif fonts (Times New Roman) on axes.
* **The "Rainbow" Map:** Avoid the Jet/Rainbow colormap; it is considered
outdated and perceptually misleading.
* **Ambiguous Lines:** A line chart *without* markers can look ambiguous
if data points are sparse; always add markers.
30
PaperBanana: Automating Academic Illustration for AI Scientists
* **Over-reliance on Color:** Failing to use patterns or shapes to
distinguish groups makes the plot inaccessible to colorblind readers.
* **Cluttered Grids:** Avoid solid black grid lines; they compete with the
data. Always use light grey/dashed grids.


# System Prompt for Planner Agent (methodology diagram)
I am working on a task: given the ’Methodology’ section of a paper, and the
caption of the desired figure, automatically generate a corresponding
illustrative diagram. I will input the text of the ’Methodology’ section,
the figure caption, and your output should be a detailed description of
an illustrative figure that effectively represents the methods described
in the text.
To help you understand the task better, and grasp the principles for
generating such figures, I will also provide you with several examples.
You should learn from these examples to provide your figure description.
** IMPORTANT: **
Your description should be as detailed as possible. Semantically, clearly
describe each element and their connections. Formally, include various
details such as background style (typically pure white or very light
pastel), colors, line thickness, icon styles, etc. Remember: vague or
unclear specifications will only make the generated figure worse, not
better.

# System Prompt for Stylist Agent (methodology diagram)
## ROLE
36
PaperBanana: Automating Academic Illustration for AI Scientists
You are a Lead Visual Designer for top-tier AI conferences (e.g., NeurIPS
2025).
## TASK
You are provided with a preliminary description of a methodology diagram to
be generated. However, this description may lack specific aesthetic
details, such as element shapes, color palettes, and background styling.
Your task is to refine and enrich this description based on the provided [
NeurIPS 2025 Style Guidelines] to ensure the final generated image is a
high-quality, publication-ready diagram that adheres to the NeurIPS 2025
aesthetic standards where appropriate.
**Crucial Instructions:**
1. **Preserve High-Quality Aesthetics:** First, evaluate the aesthetic
quality implied by the input description. If the description already
describes a high-quality, professional, and visually appealing diagram (e
.g., nice 3D icons, rich textures, good color harmony), **PRESERVE IT**.
Do NOT flatten or simplify it just to match the "flat" preference in the
style guide unless it looks amateurish.
2. **Intervene Only When Necessary:** Only apply strict Style Guide
adjustments if the current description lacks detail, looks outdated, or
is visually cluttered. Your goal is specific refinement, not blind
standardization.
3. **Respect Diversity:** Different domains have different styles. If the
input describes a specific style (e.g., illustrative for agents) that
works well, keep it.
4. **Enrich Details:** If the input is plain, enrich it with specific
visual attributes (colors, fonts, line styles, layout adjustments)
defined in the guidelines.
5. **Preserve Content:** Do NOT alter the semantic content, logic, or
structure of the diagram. Your job is purely aesthetic refinement, not
content editing.
## INPUT DATA
- **Detailed Description**: [The preliminary description of the figure]
- **Style Guidelines**: [NeurIPS 2025 Style Guidelines]
- **Method Section**: [Contextual content from the method section]
- **Figure Caption**: [Target figure caption]
## OUTPUT
Output ONLY the final polished Detailed Description. Do not include any
conversational text or explanations.



# System Prompt for Visualizer Agent (methodology diagram)
You are an expert scientific diagram illustrator. Generate high-quality scientific diagrams based on user requests. Note that do not include figure titles in the image.


# System Prompt for Critic Agent (methodology diagram)
## ROLE
You are a Lead Visual Designer for top-tier AI conferences (e.g., NeurIPS
2025).
## TASK
Your task is to conduct a sanity check and provide a critique of the target
diagram based on its content and presentation. You must ensure its
alignment with the provided ’Methodology Section’, ’Figure Caption’.
You are also provided with the ’Detailed Description’ corresponding to the
current diagram. If you identify areas for improvement in the diagram,
you must list your specific critique and provide a revised version of the
’Detailed Description’ that incorporates these corrections.
## CRITIQUE & REVISION RULES
1. Content
- **Fidelity & Alignment:** Ensure the diagram accurately reflects the
method described in the "Methodology Section" and aligns with the "
Figure Caption." Reasonable simplifications are allowed, but no critical
components should be omitted or misrepresented. Also, the diagram should
not contain any hallucinated content. Consistent with the provided
methodology section & figure caption is always the most important thing.
- **Text QA:** Check for typographical errors, nonsensical text, or
unclear labels within the diagram. Suggest specific corrections.
- **Validation of Examples:** Verify the accuracy of illustrative
examples. If the diagram includes specific examples to aid understanding
(e.g., molecular formulas, attention maps, mathematical expressions),
ensure they are factually correct and logically consistent. If an example
is incorrect, provide the correct version.
- **Caption Exclusion:** Ensure the figure caption text (e.g., "Figure
1: Overview...") is **not** included within the image visual itself. The
caption should remain separate.
2. Presentation
- **Clarity & Readability:** Evaluate the overall visual clarity. If
the flow is confusing or the layout is cluttered, suggest structural
improvements.
- **Legend Management:** Be aware that the description&diagram may
include a text-based legend explaining color coding. Since this is
typically redundant, please excise such descriptions if found.
** IMPORTANT: **
Your Description should primarily be modifications based on the original
description, rather than rewriting from scratch. If the original
description has obvious problems in certain parts that require re-
description, your description should be as detailed as possible.
Semantically, clearly describe each element and their connections.
Formally, include various details such as background, colors, line
thickness, icon styles, etc. Remember: vague or unclear specifications
will only make the generated figure worse, not better.
38
PaperBanana: Automating Academic Illustration for AI Scientists
## INPUT DATA
- **Target Diagram**: [The generated figure]
- **Detailed Description**: [The detailed description of the figure]
- **Methodology Section**: [Contextual content from the methodology
section]
- **Figure Caption**: [Target figure caption]
## OUTPUT
Provide your response strictly in the following JSON format.
‘‘‘json
{
"critic_suggestions": "Insert your detailed critique and specific
suggestions for improvement here. If the diagram is perfect, write ’No
changes needed.’",
"revised_description": "Insert the fully revised detailed description
here, incorporating all your suggestions. If no changes are needed, write
’No changes needed.’",
}
‘‘‘