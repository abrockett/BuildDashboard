Ext.define('Rally.apps.builddashboard.App', {
    extend: 'Rally.app.App',
    requires: [
        'Rally.apps.builddashboard.Calculator'
    ],
    layout: 'hbox',
    componentCls: 'app',
    items: [
        {
            xtype: 'container',
            itemId: 'leftView',
            flex: 1
        },
        {
            xtype: 'container',
            itemId: 'rightView',
            flex: 1,
            layout: 'vbox',
            items: [
                {
                    xtype: 'container',
                    itemId: 'topRightView',
                    flex: 1
                },
                {
                    xtype: 'container',
                    itemId: 'midRightView',
                    height: 450, //static height to avoid overlap
                    flex: 1
                },
                {
                    xtype: 'container',
                    itemId: 'bottomRightView',
                    width: (window.outerWidth / 2)-50,
                    flex: 1
                }
            ]
        }
    ],

    launch: function() {
        this.radioButtonPanel = this.down('#leftView').add({
            xtype: 'form',
            width: 400,
            itemId: 'radioButtons',
            border: false,
            componentCls: 'radio-buttons',
            items: [
                {
                    xtype      : 'fieldcontainer',
                    defaultType: 'radiofield',
                    layout: 'hbox',
                    defaults: {
                        flex: 1,
                        handler: this._radioButtonChanged,
                        scope: this
                    },
                    items: [
                        {
                            boxLabel  : 'Last 30 days',
                            name      : 'date',
                            numberValue: 30,
                            id        : 'radio30',
                            checked   : true
                        }, {
                            boxLabel  : 'Last 90 days',
                            name      : 'date',
                            numberValue: 90,
                            id        : 'radio90'
                        }, {
                            boxLabel  : 'Last 180 days',
                            name      : 'date',
                            numberValue: 180,
                            id        : 'radio180'
                        }
                    ]
                    
                } 
            ]
        });

        this._onRadioButtonsLoaded();      
    },

    // DO NOT SHOW THE PAGING TOOL BAR FOR EITHER GRID!!! IT WILL BREAK EVERYTHING :(
    _onRadioButtonsLoaded: function() {
        this._time = 30;
        this.buildDefGrid = this.down('#leftView').add({
            xtype: 'rallygrid',
            model: 'BuildDefinition',
            componentCls: 'build-definitions',
            itemId: 'build-def-grid',
            columnCfgs: [
                {text: 'Name', dataIndex: 'Name', flex: 2},
                {text: 'Last Status', dataIndex: 'LastStatus', flex: 1},
                {text: 'Total Success Ratio', flex: 1, renderer: function(value, metaData, record) {
                    var buildSummary = record.get('Summary').Builds;
                    var number = buildSummary.Status.SUCCESS/buildSummary.Count;
                    var colortpl =  new Ext.Template('<span class="{cls}">{number}%</span>');
                    var colorclass;

                    if (buildSummary.Status.SUCCESS === undefined) {
                        colorclass = 'lowsuccess';
                        number = 0;
                    } else if (number < 0.6) {
                        colorclass = 'lowsuccess';
                    } else if (number < 0.75) {
                        colorclass = 'medsuccess';
                    } else {
                        colorclass = 'highsuccess';
                    }

                    return colortpl.apply({number: Ext.util.Format.number(number*100, '0.0'), cls: colorclass});
                }}
            ],
            sortableColumns: false,
            listeners: {
                select: this._onCellSelected,
                scope: this
            },
            storeConfig: {
                listeners: {
                    load: this._onBuildDefinitionsRetrieved,
                    scope: this
                },
                fetch: [
                    'Name',
                    'LastStatus',
                    'LastBuild',
                    'Builds:summary[Status]'
                ],
                filters: [
                    {
                        property: 'LastBuild.CreationDate',
                        operator: '>',
                        value: Rally.util.DateTime.toIsoString(Rally.util.DateTime.add(new Date(), 
                            'day', -this._time))
                    }
                ],
                context: this.context.getDataContext(),
                pageSize: 200
            }
            //showPagingToolbar: false
        });


    },


    _onBuildDefinitionsRetrieved: function(store, records) {
        var included = false;
        var index = 0;
        
        for (i=0; i<this.buildDefGrid.store.totalCount; i++) {
            if (this.buildDefGrid.store.data.items[i].get('Name') === this._selectedBuildDefName) {
                included = true;
                index = i;
                break;
            }
        }

        if (records === null || records.length === 0) {
            this._selectedBuildDef = '';
            this._selectedBuildDefName = 'No Build Definitions Loaded For Current Time Scale.';
            this._buildBuildsGrid(0);
            this._successRatio = null;
            this._updateDisplayField();
        } else if (this._selectedBuildDef === undefined || !included) {
            this._selectedBuildDef = records[0].get('_ref');
            this._selectedBuildDefName = records[0].get('Name');
            this.buildDefGrid.getSelectionModel().select(0);
        } else {
            this.buildDefGrid.getSelectionModel().select(index);
        }
    },

    _buildBuildsGrid: function(numberValue) {
        if (this.buildsGrid) {
            var today = new Date();
            this.buildsGrid.getStore().load({
                filters: [
                    {
                        property: 'BuildDefinition',
                        operator: '=',
                        value: this._selectedBuildDef
                    },
                    {
                        property: 'CreationDate',
                        operator: '>',
                        value: Rally.util.DateTime.toIsoString(Rally.util.DateTime.add(today, 
                            'day', -(numberValue)))
                    }
                ]
            });
        } else {
            this.buildsGrid = this.down('#bottomRightView').add({
                xtype: 'rallygrid',
                model: 'Build',
                componentCls: 'builds',
                itemId: 'builds-grid',
                columnCfgs: [
                    {text: 'Build #', dataIndex: 'Number', flex: 1},
                    {text: 'Date', dataIndex: 'CreationDate', flex: 2},
                    {text: 'Duration', dataIndex: 'Duration', flex: 1},
                    {text: 'Status', dataIndex: 'Status', flex: 1}
                ],
                sortableColumns: false,
                storeConfig: {
                    filters: [
                        {
                            property: 'BuildDefinition',
                            operator: '=',
                            value: this._selectedBuildDef
                        },
                        {
                            property: 'CreationDate',
                            operator: '>',
                            value: Rally.util.DateTime.toIsoString(Rally.util.DateTime.add(new Date(), 
                                'day', -(numberValue)))
                        }
                    ],
                    context: this.context.getDataContext(),
                    pageSize: 200,
                    limit: Infinity
                }
                //showPagingToolbar: false
            });
        }

        this._makeChart(numberValue);
    },

    _onCellSelected: function(me, record, index, eOpts) {
        this._selectedBuildDef = record.get('_ref');
        this._selectedBuildDefName = record.get('Name');


        var button;
        if (Ext.getCmp('radio30').checked === true) {
            button = Ext.getCmp('radio30');
        } else if (Ext.getCmp('radio90').checked === true) {
            button = Ext.getCmp('radio90');
        } else {
            button = Ext.getCmp('radio180');
        }

        this._buildBuildsGrid(button.numberValue);

    },

    _updateDisplayField: function(){
        if (this.down('#displayclass')) {
            this.down('#topRightView').remove(this.down('#displayclass'));
        }

        var ratioColorTemplate = new Ext.Template('<span class="{cls1}">{number}%</span>');
        var slopeColorTemplate = new Ext.Template('<span class="{cls2}">{slope}</span>');
        var ratioColorClass, slopeColorClass, successText, slopeTrend;

        if (this._successRatio < 60) {
            ratioColorClass = 'lowsuccess';
        } else if (this._successRatio < 75) {
            ratioColorClass = 'medsuccess';
        } else {
            ratioColorClass = 'highsuccess';
        }

        if (this._successRatio === null) {
            successText = '<br>Click Another Button For More Data.';
        } else {
            successText = '<br><span style="font-size: 10pt">Success Ratio = ' + ratioColorTemplate.apply({number: this._successRatio, cls1: ratioColorClass});
            successText += '<br>Trend For Selected Time Scale: ';

            if (this._trendLineSlope > 0) {
                slopeColorClass = 'highsuccess';
                slopeTrend = 'Increasing';
            } else if (this._trendLineSlope < 0) {
                slopeColorClass = 'lowsuccess';
                slopeTrend = 'Decreasing';
            } else {
                slopeColorClass = 'medsuccess';
                slopeTrend = 'No Detectable Change';
            }

            successText += slopeColorTemplate.apply({slope: slopeTrend, cls2: slopeColorClass});
            successText += "</span>";
        }

        this.down('#topRightView').add({
            xtype: 'displayfield',
            value: '<span class="display-class">'+this._selectedBuildDefName+'</span>' + successText,
            itemId: 'displayclass',
            componentCls: 'display-name'
        });
    },

    _radioButtonChanged: function(button) {
        if (Ext.getCmp('radio90').checked === true) {
            this._time = 90;
        } else if (Ext.getCmp('radio180').checked === true) {
            this._time = 180;
        } else {
            this._time = 30;
        }

        if (button.checked) {
            var today = new Date();

            this.buildDefGrid.getStore().load({
                filters: [
                    {
                        property: 'LastBuild.CreationDate',
                        operator: '>',
                        value: Rally.util.DateTime.toIsoString(Rally.util.DateTime.add(new Date(), 
                            'day', -(button.numberValue)))
                    }
                ]
            });

        }
    },

    _makeChart: function(numberValue) {
        var buttonValue = Rally.util.DateTime.toIsoString(Rally.util.DateTime.add(new Date(), 
                'day', -(numberValue)));
    
        if(this.down('#midRightView').getComponent('buildsChart') !== undefined) {
            this.down('#midRightView').remove(this.down('#midRightView').getComponent('buildsChart'));
        }

        this.chart = this.down('#midRightView').add({
            xtype: 'rallychart',
            itemId: 'buildsChart',
            componentCls: 'builds-chart',
            storeType: 'Rally.data.WsapiDataStore',
            storeConfig: {
                model: 'Build',
                filters: [
                    {
                        property: 'BuildDefinition',
                        operator: '=',
                        value: this._selectedBuildDef
                    },
                    {
                        property: 'CreationDate',
                        operator: '>',
                        value: buttonValue
                    }
                ],
                limit: Infinity,
                context: this.context.getDataContext()
            },
            listeners: {
                    chartRendered: this._onChartRendered,
                    scope: this
            },

            calculatorType: 'Rally.apps.builddashboard.Calculator',
            calculatorConfig: {},
            chartColors: [],
            queryErrorMessage: '',
            //queryErrorMessage: 'No Builds Found for the Selected Time Range',
            chartConfig: {
                chart: {
                    type: 'column'
                },
                title: {
                    text: ''
                },
                plotOptions: {
                    column: {
                        groupPadding: 0,
                        borderWidth: 0
                    }
                },
                xAxis: {
                    labels: {
                        formatter: function() {
                            var size = this.chart.axes[0].categories.length;
                            var piece = Ext.util.Format.number(size/10, '0');
                            for (i = 0; i < size; i++) {
                                if (piece === '0') {
                                    return this.value;
                                }
                                if (i%piece !== 0) {
                                    this.chart.axes[0].categories[i] = '';
                                }
                            }
                            return this.value;
                        }
                    }
                },
                yAxis: {
                    min: 0,
                    max: 100,
                    title: {
                        text: 'Percentage of Successful Builds'
                    }
                },
                legend: {
                    enabled: false
                },
                tooltip: {
                    enabled: false
                }

            }
        });
    },

    _onChartRendered: function(chart) {
        this._trendLineSlope = chart.chartData.slope;
        this._successRatio = chart.chartData.ratio;
        this._updateDisplayField();
    }

    
    
});
