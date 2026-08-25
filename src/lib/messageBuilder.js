// src/lib/messageBuilder.js
function buildResultFlexMessage({ meetName, raceTitle, heat, results, targetSwimmerName }) {
  const items = results.map((r) => {
    const medal = r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : `${r.rank}`;
    
    // ターゲット選手か判定
    const isTarget = [r.swimmer_name, r.swimmer1_name, r.swimmer2_name, r.swimmer3_name, r.swimmer4_name]
        .some(name => name && name.replace(/\s+/g, '') === targetSwimmerName.replace(/\s+/g, ''));

    // 表示用データの構築
    let memberDisplay = r.swimmer_name;
    let timeDisplay = r.result_time || '-';

    if (r.swimmer1_name) {
        // リレーの場合
        const members = [
            { name: r.swimmer1_name, lap: r.lap100 },
            { name: r.swimmer2_name, lap: r.lap200 },
            { name: r.swimmer3_name, lap: r.lap300 },
            { name: r.swimmer4_name, lap: r.lap400 }
        ].filter(m => m.name);
        
        memberDisplay = members.map(m => `${m.name}(${m.lap || '-'})`).join('\n');
    } else if (r.lap_count && parseInt(r.lap_count) > 0) {
        // 個人の場合（ラップタイムがある場合）
        const lapFields = ['lap50', 'lap100', 'lap150', 'lap200', 'lap250', 'lap300', 'lap350', 'lap400', 'lap450', 'lap500', 'lap550', 'lap600', 'lap650', 'lap700', 'lap750', 'lap800', 'lap850', 'lap900', 'lap950', 'lap1000', 'lap1050', 'lap1100', 'lap1150', 'lap1200', 'lap1250', 'lap1300', 'lap1350', 'lap1400', 'lap1450', 'lap1500'];
        const laps = lapFields.map(f => r[f]).filter(l => l);
        
        if (laps.length > 0) {
            memberDisplay = `${r.swimmer_name}\n[ラップ] ${laps.join(', ')}`;
        }
    }

    return {
      type: 'box',
      layout: 'horizontal',
      contents: [
        { type: 'text', text: medal, weight: 'bold', size: 'md', align: 'center', flex: 1 },
        { type: 'text', text: memberDisplay, size: 'xs', flex: 3, wrap: true },
        { type: 'text', text: timeDisplay, size: 'sm', color: '#ff6b6b', weight: 'bold', flex: 2 },
      ],
      backgroundColor: isTarget ? '#FFFACD' : '#ffffff',
      paddingBottom: '4px'
    };
  });

  return {
    type: 'flex',
    altText: `【結果】${meetName} - ${raceTitle}`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: `🏊 ${meetName}`, weight: 'bold', size: 'sm', color: '#ffffff' },
          { type: 'text', text: raceTitle, weight: 'bold', size: 'lg', color: '#ffffff', wrap: true },
          { type: 'text', text: `${heat}組`, weight: 'bold', size: 'sm', color: '#ffffff', align: 'end' },
        ],
        backgroundColor: '#1E90FF',
        paddingAll: '12px',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: '順位', size: 'xs', color: '#999999', flex: 1 },
              { type: 'text', text: '選手名/メンバー・ラップ', size: 'xs', color: '#999999', flex: 3 },
              { type: 'text', text: '合計Time', size: 'xs', color: '#999999', flex: 2 },
            ],
            paddingBottom: '4px',
            borderWidth: 'light',
            borderColor: '#eeeeee',
          },
          ...items,
        ],
        paddingAll: '12px',
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: '✅ レース結果が確定しました', color: '#1E90FF', size: 'xs', align: 'center' },
        ],
      },
    },
  };
}

module.exports = { buildResultFlexMessage };
