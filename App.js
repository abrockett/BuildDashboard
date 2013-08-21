Ext.define('Rally.apps.builddashboard.App', {
    extend: 'Rally.app.App',
    requires: [
        'Rally.apps.builddashboard.Calculator'
    ],
    layout: 'hbox',
    componentCls: 'builddashboard',
    items: [
        {
            xtype: 'container',
            itemId: 'leftView',
            flex: 1,
            layout: 'vbox',
            items: [
                {
                    xtype: 'container',
                    itemId: 'radioContainer',
                    width: '100%',
                    flex: 1
                },
                {
                    xtype: 'container',
                    itemId: 'bottomLeftView',
                    width: '100%',
                    flex: 1
                }
            ]
        },
        {
            xtype: 'container',
            itemId: 'rightView',
            flex: 3,
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
                    height: 400, //static height to avoid overlap
                    width: '97%',
                    flex: 1
                },
                {
                    xtype: 'container',
                    itemId: 'bottomRightView',
                    width: '97%',
                    flex: 1
                }
            ]
        }
    ],

    launch: function() {
        console.log('Launched app');
        //this._selectedBuildDef = {};
        Rally.data.ModelFactory.getModels({
            types: ['Build', 'BuildDefinition'],
            success: function(models) {
                this.models = models;
                this._makePanel();
            },
            scope: this
        });
    },

    _makePanel: function() {
        console.log('Make radio button panel');
        this.radioButtonPanel = this.down('#radioContainer').add({
            xtype: 'form',
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

    // DO NOT SHOW THE PAGING TOOL BAR FOR THE BUILDDEF GRID
    _onRadioButtonsLoaded: function() {
        //debugger;
        this._time = 30;

        var buildDefStoreConfig = this._getBuildDefStoreConfig({
            model: this.models.BuildDefinition
        });
        console.log('Tell build-def grid to be made');
        this.down('#bottomLeftView').add(this._getBuildDefGridConfig({
            itemId: 'build-def-grid',
            model: this.models.BuildDefinition,
            storeConfig: buildDefStoreConfig
        }));
    },

    _getBuildDefStoreConfig: function(config){
        console.log('Get build-def store config');
        return Ext.apply({
            listeners: {
                load: this._onBuildDefinitionsRetrieved,
                scope: this
            },
            fetch: ['Name', 'LastStatus', 'LastBuild', 'Builds:summary[Status]'],
            filters: this._getBuildDefFilters(),
            context: this.context.getDataContext()
        }, config);
    },

    _getBuildDefFilters: function() {
        console.log('Get build-def filter');
        return [
            {
                property: 'LastBuild.CreationDate',
                operator: '>',
                value: Rally.util.DateTime.toIsoString(Rally.util.DateTime.add(new Date(), 
                    'day', -this._time))
            }
        ];
    },

    _getBuildDefGridConfig: function(config) {
        console.log('Create build-def grid');
        return Ext.apply({
            xtype: 'rallygrid',
            componentCls: 'build-definitions',
            columnCfgs: [
                {text: 'Name', dataIndex: 'Name', flex: 2},
                {text: 'Last Build Status', dataIndex: 'LastStatus', flex: 1},
                {text: 'Success Ratio', flex: 1, renderer: function(value, metaData, record) {
                    var buildSummary = record.get('Summary').Builds;
                    var number = buildSummary.Status.SUCCESS/buildSummary.Count;
                    var colortpl =  new Ext.Template('<span class="{cls}">{number}%</span>');
                    var colorclass;

                    if (!buildSummary.Status.SUCCESS) {
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
            showPagingToolbar: false,
            listeners: {
                select: this._onCellSelected,
                scope: this
            }
        }, config);
    },

    _onBuildDefinitionsRetrieved: function(store, records) {
        console.log('Selection Code, Tell app to update stuff');
        var included = false;
        var index = 0;

        for (i=0; i < this.down('#build-def-grid').store.data.length; i++) {
            if (this.down('#build-def-grid').store.data.items[i].get('Name') === this._selectedBuildDefName) {
            //if (this.down('#build-def-grid').store.data.items[i].get('Name') === this._selectedBuildDef.Name) {
                included = true;
                index = i;
                break;
            }
        }

        if (records === null || records.length === 0) {
            this._selectedBuildDef = '';
            this._selectedBuildDefName = 'No Build Definitions Loaded For Current Time Scale.';
            //this._selectedBuildDef._ref = '';
            //this._selectedBuildDef.Name = 'No Build Definitions Loaded For Current Time Scale.';
            //this._selectedBuildDef = {_ref: '', Name: 'No Build Definitions Loaded For Current Time Scale.'};

            this._buildBuildsGrid();
            this._successRatio = null;
            this._updateDisplayField();
        } else if (!this._selectedBuildDef || !included) {
        //} else if (!this._selectedBuildDef._ref || !included) {
            this._selectedBuildDef = records[0].get('_ref');
            this._selectedBuildDefName = records[0].get('Name');
            //this._selectedBuildDef._ref = records[0].get('_ref');
            //this._selectedBuildDef.Name = records[0].get('Name');
            //this._selectedBuildDef = {_ref: records[0].get('_ref'), Name: records[0].get('Name')};

            this.down('#build-def-grid').getSelectionModel().select(0);
        } else {
            this.down('#build-def-grid').getSelectionModel().select(index);
        }
    },

    _buildBuildsGrid: function() {
        var buildsStoreConfig = this._getBuildsStoreConfig({
            model: this.models.Build
        });
        console.log('Tell builds grid to build');
        this.down('#bottomRightView').add(this._getBuildsGridConfig({
            itemId: 'builds-grid',
            model: this.models.Build,
            storeConfig: buildsStoreConfig
        }));

        this._makeChart();
    },

    _getBuildsGridConfig: function(config) {
        console.log('Create builds grid');
        return Ext.apply({
            xtype: 'rallygrid',
            componentCls: 'builds',
            columnCfgs: [
                {text: 'Build #', dataIndex: 'Number', flex: 1},
                {text: 'Date', dataIndex: 'CreationDate', flex: 2},
                {text: 'Duration', dataIndex: 'Duration', flex: 1},
                {text: 'Status', dataIndex: 'Status', flex: 1}
            ]
        }, config);
    },

    _getBuildsStoreConfig: function(storeConfig) {
        console.log('Get builds store config');
        return Ext.apply({
            filters: this._getBuildsAndChartFilters(),
            context: this.context.getDataContext()
        }, storeConfig);
    },

    _getBuildsAndChartFilters: function() {
        console.log('Get builds / chart filters');
        return [
            {
                property: 'BuildDefinition',
                operator: '=',
                value: this._selectedBuildDef
                //value: this._selectedBuildDef._ref
            },
            {
                property: 'CreationDate',
                operator: '>',
                value: Rally.util.DateTime.toIsoString(Rally.util.DateTime.add(new Date(), 
                    'day', -(this._time)))
            }
        ];
    },

    _onCellSelected: function(me, record) {
        console.log('Cell selected');
        this._selectedBuildDef = record.get('_ref');
        this._selectedBuildDefName = record.get('Name');
        //this._selectedBuildDef._ref = record.get('_ref');
        //this._selectedBuildDef.Name = record.get('Name');

        //this._selectedBuildDef = {_ref: record.get('_ref'), Name: record.get('Name')};

        this._buildBuildsGrid();

    },

    _updateDisplayField: function(){
        console.log('Update Display Field');
        var displayFieldTemplate = new Ext.Template('<br><span style="font-size: 10pt">Success Ratio = ' +
            '<span class="{numberclass}">{number}%</span><br>Trend For Selected Time Scale: ' +
            '<span class="{slopeclass}">{slope}</span></span>');

        var ratioColorClass, slopeColorClass, successText, slopeTrend;

        if (this._successRatio === null) {
            successText = '<br>Click Another Button For More Data.';
        } else {
            if (this._successRatio < 60) {
                ratioColorClass = 'lowsuccess';
            } else if (this._successRatio < 75) {
                ratioColorClass = 'medsuccess';
            } else {
                ratioColorClass = 'highsuccess';
            }

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

            successText = displayFieldTemplate.apply({number: this._successRatio, numberclass: ratioColorClass,
                slope: slopeTrend, slopeclass: slopeColorClass});
        }

        if (this.down('#displayclass')) {
            this.down('#topRightView').remove(this.down('#displayclass'));
        }

        this.down('#topRightView').add({
            xtype: 'displayfield',
            value: '<span class="display-class">'+this._selectedBuildDefName+'</span>' + successText,
            //value: '<span class="display-class">'+this._selectedBuildDef.Name+'</span>' + successText,
            itemId: 'displayclass',
            componentCls: 'display-name'
        });
    },

    _radioButtonChanged: function(button) {
        console.log('Radio button handler');
        if (button.checked) {
            this._time = button.numberValue;

            this.down('#build-def-grid').getStore().load({
                filters: this._getBuildDefFilters()
            });
        }
    },

    _makeChart: function() {
        console.log('Make chart');
        //debugger;
        if (this.down('#buildsChart')) {
            //this.down('#midRightView').remove(this.down('#buildsChart'), true);
            this.remove(this.down('#buildsChart'));
        }

        this.down('#midRightView').add({
            xtype: 'rallychart',
            width: '100%',
            itemId: 'buildsChart',
            componentCls: 'builds-chart',
            storeType: 'Rally.data.WsapiDataStore',
            storeConfig: {
                model: 'Build',
                filters: this._getBuildsAndChartFilters(),
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
            queryErrorMessage: 'error?',
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
                            var piece = Ext.util.Format.number(size/25, '0');
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
        console.log('Chart renderer');
        this._trendLineSlope = chart.chartData.slope;
        this._successRatio = chart.chartData.ratio;
        this._updateDisplayField();
    }

    
    
});
