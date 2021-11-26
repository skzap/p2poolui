let apiUrl = 'https://p2pool.observer/api/'
if (localStorage.getItem('isMini') == "true")
  apiUrl = 'https://mini.p2pool.observer/api/'
let maxShares = 2160
let maxPayouts = 10
let data = {}
let minerAddress = localStorage.getItem('minerAddress')
document.getElementById('minerAddress').value = minerAddress
const apiPoolInfo = async () => {
  let poolInfo = await (await fetch(apiUrl+'pool_info')).json()
  data.globalHashrate = formatNumber(Math.round(parseInt(poolInfo.mainchain.difficulty, 16) / 120))+'h/s'
  data.poolHashrate = formatNumber(Math.round(parseInt(poolInfo.sidechain.difficulty, 16) / 10))+'h/s'
  data.activeMiners = poolInfo.sidechain.window.miners
  data.knownMiners = poolInfo.sidechain.miners
  data.blocksFound = parseInt(poolInfo.sidechain.found)
  data.poolHeight = poolInfo.sidechain.height
  data.avgEffort = poolInfo.sidechain.effort.average.toFixed(2)+'%'
  data.curEffort = poolInfo.sidechain.effort.current.toFixed(2)+'%'
  data.pplnsBlocks = poolInfo.sidechain.window.blocks
  displayData()
}

const apiFoundBlocks = async (limit) => {
  let foundBlocks = await (await fetch(apiUrl+'found_blocks?limit='+limit)).json()
  data.lastBlock = formatTime(foundBlocks[0].timestamp)
  displayData()

  if (limit>1)
    displayBlocks(foundBlocks)
}

const apiShares = async () => {
  if (!minerAddress) return
  try {
    let myShares = await (await fetch(apiUrl+'shares?limit=2160')).json()
    statsChart(myShares)
  } catch (error) {
    console.log(error)
  }
}

const apiMyShares = async (limit) => {
  if (!minerAddress) return
  try {
    let myShares = await (await fetch(apiUrl+'shares?limit='+limit+'&miner='+minerAddress)).json()
    hashrateChart(myShares)
  } catch (error) {
    data.myHashrate = 'N/A '
    displayData('myHashrate')
    console.log(error)
  }
}

const apiMyPayouts = async (limit) => {
  if (!minerAddress) return
  let myPayouts = await (await fetch(apiUrl+'payouts/'+minerAddress+'?search_limit='+limit)).json()
  displayPayouts(myPayouts)
}

// router
document.addEventListener("DOMContentLoaded", async function(){
  router()
});
window.onhashchange = function(event) {
  router()
}

document.getElementById("checkboxApi").onchange = function(event) {
  localStorage.setItem('isMini', event.target.checked)
  window.location.reload()
}

async function router() {
  let currentPage = location.hash.replace('#','')
  if (!currentPage) currentPage = 'home'
  let pages = document.getElementsByClassName('nav')
  for (let i = 0; i < pages.length; i++) {
    if (pages[i].id == 'nav.'+currentPage)
      pages[i].style.display = ''
    else
      pages[i].style.display = 'none'
  }

  let links = document.getElementsByClassName('p-navigation__link')
  for (let i = 0; i < links.length; i++) {
    const link = links[i]
    const iLink = link.href.split('/')[link.href.split('/').length-1].replace('#','')
    if (iLink == location.hash.replace('#',''))
      link.parentElement.classList.add('is-selected')
    else
      link.parentElement.classList.remove('is-selected')
  }

  await apiPoolInfo()
  await apiFoundBlocks(1)

  switch (currentPage) {
    case 'dashboard':
      apiMyShares(maxShares)
      apiMyPayouts(maxPayouts)
      break;

    case 'stats':
      // apiShares()
      apiFoundBlocks(100)
      break;
  
    default:
      break;
  }
}

// dashboard
document.getElementById('minerAddress').addEventListener('input', function (evt) {
  minerAddress = this.value
  localStorage.setItem('minerAddress', this.value)
  apiMyShares(maxShares)
  apiMyPayouts(maxPayouts)
});

function hashrateChart(shares) {
  let startHeight = shares[shares.length-1].height
  let curHeight = data.poolHeight
  let labels = []
  let tHeight = startHeight
  while (tHeight < curHeight) {
    let now = Math.round(new Date().getTime())
    let tTime = new Date(now - (curHeight-tHeight) * 10000)
    labels.push(tTime.getDate()+'/'+(1+tTime.getMonth()))
    tHeight += 60 // 60 blocks = 10 minutes
  }
  let nShares = Array(labels.length)
  let nHash10m = Array(labels.length)
  let nHash1h = Array(labels.length)
  let nHash24h = Array(labels.length)
  for (let i = 0; i < nShares.length; i++) {
    nShares[i] = 0
    nHash10m[i] = 0
    nHash1h[i] = 0
    nHash24h[i] = 0
  }
    
  for (let i = 0; i < shares.length; i++) {
    let index = Math.floor((shares[i].height-startHeight) / 60)
    nShares[index]++
    nHash10m[index] += Math.round(parseInt(shares[i].difficulty, 16) / 600)
    
    let y = 0
    while (index+y < nHash1h.length && y < 6) {
      nHash1h[index+y] += nHash10m[index]/6
      y++
    }
    y = 0
    while (index+y < nHash24h.length && y < 144) {
      nHash24h[index+y] += nHash10m[index]/144
      y++
    }
  }
  data.myHashrate = formatNumber(nHash24h[nHash24h.length-1])+'h/s'
  displayData('myHashrate')

  let chartData = {
    labels: labels,
    series: [
      nHash24h
    ]
  }
  
  new Chartist.Line('#hashrateChart', chartData, {
    showPoint: false,
    lineSmooth: true,
    axisX: {
      labelInterpolationFnc: function(value, index) {
        return index % 144 === 0 ? value : null;
      },
      showGrid: true,
      showLabel: true
    },
    axisY: {
      offset: 60,
      scaleMinSpace: 30,
      showGrid: true,
      showLabel: true
    }
  })
}

function displayPayouts(payouts) {
  let html = ''
  for (let i = 0; i < payouts.length; i++) {
    const payout = payouts[i]
    html += '<tr>'
    html += '<td>'+payout.main.height+'</td>'
    html += '<td>'+payout.height+'</td>'
    html += '<td>'+payout.coinbase.reward/Math.pow(10,12)+' XMR</td>'
    html += '<td><a href="https://xmrchain.net/tx/'+payout.coinbase.id+'" target="_blank">'+payout.coinbase.id+'</a></td>'
    html += '<td><a href="https://www.exploremonero.com/receipt/'+payout.coinbase.id+'/'+minerAddress+'/'+payout.coinbase.private_key+'" target="_blank">'+payout.coinbase.private_key+'</td>'
    html += '</tr>'
    
  }
  document.getElementById('bodyPayouts').innerHTML = html
}

// stats
function statsChart(blocks) {
  let labels = []
  let values = []
  for (let i = blocks.length-1; i >= 0; i--) {
    let block = blocks[i]
    labels.push(block.main.height)
    let poolHashrate = parseInt(block.difficulty, 16) / 10
    values.push(poolHashrate)
  }
  
  let chartData = {
    labels: labels,
    series: [
      values
    ]
  }
  
  new Chartist.Line('#poolHashrateChart', chartData, {
    showPoint: false,
    lineSmooth: true,
    axisX: {
      labelInterpolationFnc: function(value, index) {
        return index % 6 === 0 ? value : null;
      },
      showGrid: true,
      showLabel: true
    },
    axisY: {
      offset: 60,
      scaleMinSpace: 30,
      showGrid: true,
      showLabel: true
    }
  })
}

function displayBlocks(blocks) {
  let html = ''
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]
    let effort = 'N/A'
    if (i+1<blocks.length) {
      let globalHashrate = parseInt(blocks[i+1].template.difficulty, 16) / 120
      globalHashrate += parseInt(block.template.difficulty, 16) / 120
      let poolHashrate = parseInt(blocks[i+1].difficulty, 16) / 10
      poolHashrate += parseInt(block.difficulty, 16) / 10
      effort = ((100*(block.main.height - blocks[i+1].main.height) * (poolHashrate/globalHashrate)).toFixed(1))
    }

    html += '<tr>'
    html += '<td>'+block.main.height+'</td>'
    html += '<td>'+block.height+'</td>'
    if (effort === 'N/A') {
      html += '<td>'+effort+'</td>'
    } else if (effort <= 100) {
      html += '<td style="color: green">'+effort+'%</td>'
    } else if (effort <= 200) {
      html += '<td style="color: #FF4F00">'+effort+'%</td>'
    } else {
      html += '<td style="color: red">'+effort+'%</td>'
    }
    
    
    html += '<td>'+block.coinbase.reward/Math.pow(10,12)+' XMR</td>'
    html += '<td>'+block.miner+'</td>'
    html += '<td><a href="https://xmrchain.net/tx/'+block.coinbase.id+'" target="_blank">'+block.coinbase.id+'</a></td>'
    html += '</tr>'
  }
  document.getElementById('bodyBlocks').innerHTML = html

  statsChart(blocks)
}

// convenience functions
function displayData(elemId) {
  if (elemId) {
    document.getElementById(elemId).innerHTML = data[elemId]
    return
  }
  let elements = document.getElementsByClassName('data')
  for (let i = 0; i < elements.length; i++) {
    const el = elements[i]
    if (data[el.id])
      el.innerHTML = data[el.id]
  }
}

function formatNumber(i) {
  let suffix = ''
  if (i > Math.pow(10,9)) {
    suffix = 'G'
    i = Math.round(i / Math.pow(10,7)) / 100
  }
  else if (i > Math.pow(10,6)) {
    suffix = 'M'
    i = Math.round(i / Math.pow(10,4)) / 100
  }
  else if (i > Math.pow(10,3)) {
    suffix = 'K'
    i = Math.round(i / Math.pow(10,1)) / 100
  }

  return i+' '+suffix
}

function formatTime(t) {
  let diff = (new Date().getTime()/1000) - t
  let suffix = 'sec'
  if (diff > 60) {
    diff = Math.round(diff/60)
    suffix = 'min'
    if (diff > 60) {
      diff = Math.round(diff/60)
      suffix = 'hour'
      if (diff > 24) {
        diff = Math.round(diff/24)
        suffix = 'day'
      }
    }
  }
  if (diff >= 2) suffix += 's'
  return diff+' '+suffix+' ago'
}